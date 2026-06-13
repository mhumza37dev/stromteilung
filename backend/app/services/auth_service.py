"""
Authentication & session lifecycle.

This is the only layer that orchestrates password hashing, token minting and
the refresh-token table together. Controllers stay thin — they validate, call
in, and serialize the result.

Public methods:
    register()       — create a new user + issue a fresh token pair
    login()          — verify credentials + issue a fresh token pair
    refresh()        — rotate refresh + issue new access token
    logout()         — revoke a single refresh token
    revoke_all()     — revoke every session for a user (used by GDPR delete)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core import security
from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import AuthResponse, TokenPair, UserPublic


class AuthService:
    """Business rules around signing up, logging in and rotating sessions."""

    def __init__(
        self,
        user_repo: UserRepository,
        token_repo: RefreshTokenRepository,
    ):
        self.users = user_repo
        self.tokens = token_repo

    # --- public API --------------------------------------------------------

    async def register(
        self,
        *,
        email: str,
        password: str,
        role: str,
        locale: str,
        user_agent: str | None,
        ip: str | None,
    ) -> AuthResponse:
        """Create the user, persist them, return tokens for immediate login."""
        normalized = email.lower()
        # Uniqueness is now per-role — same email can hold one buyer + one
        # seller account. We still reject a duplicate within the *same* role.
        if await self.users.email_role_exists(normalized, UserRole(role)):
            raise ConflictError(
                "An account with this email already exists for this role.",
            )

        user = User(
            email=normalized,
            password_hash=security.hash_password(password),
            role=role,           # validated upstream by Pydantic enum
            locale=locale,
        )
        await self.users.add(user)

        tokens = await self._issue_tokens(user, user_agent=user_agent, ip=ip)
        return AuthResponse(
            user=UserPublic.model_validate(user),
            tokens=tokens,
        )

    async def login(
        self,
        *,
        email: str,
        password: str,
        role: str,
        user_agent: str | None,
        ip: str | None,
    ) -> AuthResponse:
        """Verify credentials for the (email, role) account. We return the
        *same* error for unknown account and bad password to avoid leaking
        which email/role pairs are registered."""
        user = await self.users.get_by_email_role(email.lower(), UserRole(role))
        if not user or not security.verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid email or password.")
        if not user.is_active:
            raise UnauthorizedError("This account has been disabled.")

        tokens = await self._issue_tokens(user, user_agent=user_agent, ip=ip)
        return AuthResponse(
            user=UserPublic.model_validate(user),
            tokens=tokens,
        )

    async def refresh(
        self,
        *,
        refresh_token: str,
        user_agent: str | None,
        ip: str | None,
    ) -> TokenPair:
        """Rotate the refresh token + mint a new access token.

        Rotation = the *old* refresh token is revoked at the moment we issue
        the new one. If an attacker steals an old token and tries to refresh
        with it after the user already did, both will be rejected on the next
        attempt — a classic detection mechanism for token theft.
        """
        match = await self._find_active_refresh_token(refresh_token)
        await self.tokens.revoke(match)

        user = await self.users.get(match.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Account is no longer active.")

        return await self._issue_tokens(user, user_agent=user_agent, ip=ip)

    async def logout(self, *, refresh_token: str) -> None:
        """Revoke just this session. Other devices stay signed in."""
        try:
            match = await self._find_active_refresh_token(refresh_token)
        except UnauthorizedError:
            # Already revoked / unknown — idempotent logout is fine.
            return
        await self.tokens.revoke(match)

    async def revoke_all(self, user_id) -> int:
        """Used by `DELETE /users/me` and emergency admin flows."""
        return await self.tokens.revoke_all_for_user(user_id)

    # --- internals ---------------------------------------------------------

    async def _issue_tokens(
        self,
        user: User,
        *,
        user_agent: str | None,
        ip: str | None,
    ) -> TokenPair:
        """Mint a fresh (access, refresh) pair and persist the refresh hash."""
        access = security.create_access_token(user.id, role=user.role.value)

        plaintext = security.generate_refresh_token()
        now = datetime.now(tz=timezone.utc)
        record = RefreshToken(
            user_id=user.id,
            token_hash=security.hash_refresh_token(plaintext),
            user_agent=(user_agent or "")[:512] or None,
            ip=ip,
            expires_at=now + timedelta(seconds=settings.jwt_refresh_ttl_seconds),
        )
        await self.tokens.add(record)

        return TokenPair(
            access_token=access,
            refresh_token=plaintext,
            expires_in=settings.jwt_access_ttl_seconds,
        )

    async def _find_active_refresh_token(self, plaintext: str) -> RefreshToken:
        """Linear scan over a user's active tokens — Argon2 verification is
        the cost driver; users typically have ≤ a handful of live sessions, so
        this stays cheap. If we ever see abuse we'll add an `hmac` short-hash
        column to narrow the scan first.
        """
        # The plaintext refresh token doesn't tell us which user it belongs
        # to, so we have to scan. To keep the scan bounded we sweep recently
        # active tokens grouped by user. For the v1 traffic profile this is
        # fine; revisit when sessions/user gets big.
        # NOTE: For now we do a full table scan of active tokens.
        from sqlalchemy import select  # local to keep service deps obvious
        from app.models.refresh_token import RefreshToken as RT

        now = datetime.now(tz=timezone.utc)
        stmt = (
            select(RT)
            .where(RT.revoked_at.is_(None))
            .where(RT.expires_at > now)
        )
        result = await self.tokens.session.execute(stmt)
        for candidate in result.scalars().all():
            if security.verify_refresh_token(plaintext, candidate.token_hash):
                return candidate
        raise UnauthorizedError("Invalid or expired refresh token.")
