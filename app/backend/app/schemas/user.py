"""Pydantic schemas for User model."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import EmailStr, Field, field_validator

from app.schemas.base import BaseSchema, TenantScopedSchema


class UserBase(BaseSchema):
    """Base schema for User with common fields."""

    email: EmailStr
    first_name: Annotated[str | None, Field(max_length=100)] = None
    last_name: Annotated[str | None, Field(max_length=100)] = None


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: Annotated[str, Field(min_length=8, max_length=100)]
    is_active: bool = True

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseSchema):
    """Schema for updating a user."""

    first_name: Annotated[str | None, Field(max_length=100)] = None
    last_name: Annotated[str | None, Field(max_length=100)] = None
    is_active: bool | None = None


class UserPasswordUpdate(BaseSchema):
    """Schema for updating user password."""

    current_password: str
    new_password: Annotated[str, Field(min_length=8, max_length=100)]

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserRead(TenantScopedSchema):
    """Schema for reading user data."""

    email: str
    first_name: str | None
    last_name: str | None
    full_name: str
    is_active: bool
    is_verified: bool
    is_superuser: bool
    verified_at: datetime | None
    last_login_at: datetime | None
    deleted_at: datetime | None


class UserBrief(BaseSchema):
    """Brief user schema for nested references."""

    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool


class UserWithRoles(UserRead):
    """User with roles included."""

    role_ids: list[uuid.UUID] = Field(default_factory=list)
    role_names: list[str] = Field(default_factory=list)


class UserLogin(BaseSchema):
    """Schema for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    """Schema for token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseSchema):
    """Schema for refresh token request."""

    refresh_token: str


class PasswordResetRequest(BaseSchema):
    """Schema for password reset request."""

    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    """Schema for password reset confirmation."""

    token: str
    new_password: Annotated[str, Field(min_length=8, max_length=100)]

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v