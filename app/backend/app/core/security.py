"""Security utilities for authentication and authorization."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.constants import TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to compare against
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    roles: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.
    
    Args:
        user_id: UUID of the user
        tenant_id: UUID of the tenant
        roles: List of role names
        expires_delta: Custom expiration time (default: 15 minutes)
        
    Returns:
        Encoded JWT access token
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "roles": roles or [],
        "exp": expire,
        "iat": now,
        "type": TOKEN_TYPE_ACCESS,
    }
    
    return jwt.encode(
        payload,
        settings.jwt_private_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        user_id: UUID of the user
        tenant_id: UUID of the tenant
        expires_delta: Custom expiration time (default: 7 days)
        
    Returns:
        Encoded JWT refresh token
    """
    if expires_delta is None:
        expires_delta = timedelta(days=settings.jwt_refresh_token_expire_days)
    
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "exp": expire,
        "iat": now,
        "type": TOKEN_TYPE_REFRESH,
    }
    
    return jwt.encode(
        payload,
        settings.jwt_private_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        JWTError: If token is invalid or expired
    """
    return jwt.decode(
        token,
        settings.jwt_public_key,
        algorithms=[settings.jwt_algorithm],
    )


def verify_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """
    Verify a JWT token and return its payload.
    
    Args:
        token: JWT token string
        expected_type: Expected token type (access or refresh)
        
    Returns:
        Decoded token payload
        
    Raises:
        JWTError: If token is invalid, expired, or wrong type
    """
    payload = decode_token(token)
    
    if expected_type and payload.get("type") != expected_type:
        raise JWTError(f"Expected {expected_type} token, got {payload.get('type')}")
    
    return payload


class TokenPayload:
    """Parsed JWT token payload."""

    def __init__(self, payload: dict[str, Any]) -> None:
        self.user_id: uuid.UUID = uuid.UUID(payload["sub"])
        self.tenant_id: uuid.UUID = uuid.UUID(payload["tenant_id"])
        self.roles: list[str] = payload.get("roles", [])
        self.token_type: str = payload.get("type", TOKEN_TYPE_ACCESS)
        self.expires_at: datetime = datetime.fromtimestamp(
            payload["exp"], tz=timezone.utc
        )
        self.issued_at: datetime = datetime.fromtimestamp(
            payload["iat"], tz=timezone.utc
        )

    @classmethod
    def from_token(cls, token: str) -> "TokenPayload":
        """Create TokenPayload from a JWT token."""
        payload = decode_token(token)
        return cls(payload)

    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.now(timezone.utc) > self.expires_at

    def __repr__(self) -> str:
        return f"<TokenPayload user={self.user_id} tenant={self.tenant_id}>"