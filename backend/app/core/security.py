"""
Cryptographic primitives: password hashing + JWT encode/decode.

Centralized so we can change algorithms once and have the entire app follow.
We use Argon2id (OWASP-recommended) for passwords and HS256 for JWTs — the
HS256 signing key comes from `APP_SECRET_KEY`, so rotating it invalidates all
issued access tokens (refresh tokens are stored in the DB and can be revoked
independently).
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return an Argon2id hash for the given plaintext password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time compare a plaintext password against a stored hash."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT (access tokens)
# ---------------------------------------------------------------------------

TokenType = Literal["access", "refresh"]


def _create_token(
    subject: str,
    token_type: TokenType,
    ttl_seconds: int,
    extra: dict[str, Any] | None = None,
) -> str:
    """Build and sign a JWT with our standard claims."""
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "type": token_type,
        "jti": uuid.uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(
        payload,
        settings.app_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def create_access_token(user_id: uuid.UUID, *, role: str) -> str:
    """Short-lived access token carrying the user's role."""
    return _create_token(
        subject=str(user_id),
        token_type="access",
        ttl_seconds=settings.jwt_access_ttl_seconds,
        extra={"role": role},
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode + validate an access token. Raises `UnauthorizedError` on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.app_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as e:
        raise UnauthorizedError("Invalid or expired access token.") from e

    if payload.get("type") != "access":
        raise UnauthorizedError("Wrong token type.")
    return payload


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------
# Refresh tokens are *opaque* (random bytes), not JWTs. We hash them before
# storing so a DB leak doesn't expose live sessions, mirroring how API keys
# are handled later in the project.
# ---------------------------------------------------------------------------

def generate_refresh_token() -> str:
    """Cryptographically-random opaque refresh token (URL-safe)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(plain: str) -> str:
    """Argon2 hash for at-rest storage of refresh tokens."""
    return _pwd_context.hash(plain)


def verify_refresh_token(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)
