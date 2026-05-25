"""
Convenience re-exports for the model registry.

Alembic's `env.py` imports this module so every model is registered with
`Base.metadata` before autogenerate runs.
"""
from app.models.inquiry import Inquiry
from app.models.listing import Listing
from app.models.profile import Profile
from app.models.rating import Rating
from app.models.refresh_token import RefreshToken
from app.models.transformer import Transformer
from app.models.user import Locale, User, UserRole

__all__ = [
    "User",
    "UserRole",
    "Locale",
    "RefreshToken",
    "Transformer",
    "Profile",
    "Listing",
    "Inquiry",
    "Rating",
]
