"""Pydantic schemas for Tenant model."""

import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import EmailStr, Field, field_validator

from app.core.constants import SubscriptionPlan, TenantStatus
from app.schemas.base import BaseSchema, GlobalBaseSchema


class TenantBase(BaseSchema):
    """Base schema for Tenant with common fields."""

    name: Annotated[str, Field(min_length=1, max_length=255)]
    slug: Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")]
    domain: Annotated[str | None, Field(max_length=255)] = None
    contact_email: EmailStr | None = None
    contact_phone: Annotated[str | None, Field(max_length=20)] = None


class TenantCreate(TenantBase):
    """Schema for creating a new tenant."""

    subscription_plan: SubscriptionPlan = SubscriptionPlan.FREE
    address_line1: Annotated[str | None, Field(max_length=255)] = None
    address_line2: Annotated[str | None, Field(max_length=255)] = None
    city: Annotated[str | None, Field(max_length=100)] = None
    state: Annotated[str | None, Field(max_length=100)] = None
    country: Annotated[str | None, Field(max_length=100)] = None
    postal_code: Annotated[str | None, Field(max_length=20)] = None
    gstin: Annotated[str | None, Field(max_length=15)] = None
    pan: Annotated[str | None, Field(max_length=10)] = None
    settings: dict[str, Any] = Field(default_factory=dict)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """Validate slug format."""
        if not v:
            raise ValueError("Slug cannot be empty")
        if not v.replace("-", "").isalnum():
            raise ValueError("Slug must contain only alphanumeric characters and hyphens")
        return v.lower()

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: str | None) -> str | None:
        """Validate GSTIN format (Indian GST number)."""
        if v is None:
            return v
        if len(v) != 15:
            raise ValueError("GSTIN must be 15 characters")
        return v.upper()

    @field_validator("pan")
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        """Validate PAN format (Indian PAN number)."""
        if v is None:
            return v
        if len(v) != 10:
            raise ValueError("PAN must be 10 characters")
        return v.upper()


class TenantUpdate(BaseSchema):
    """Schema for updating a tenant."""

    name: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    domain: Annotated[str | None, Field(max_length=255)] = None
    contact_email: EmailStr | None = None
    contact_phone: Annotated[str | None, Field(max_length=20)] = None
    address_line1: Annotated[str | None, Field(max_length=255)] = None
    address_line2: Annotated[str | None, Field(max_length=255)] = None
    city: Annotated[str | None, Field(max_length=100)] = None
    state: Annotated[str | None, Field(max_length=100)] = None
    country: Annotated[str | None, Field(max_length=100)] = None
    postal_code: Annotated[str | None, Field(max_length=20)] = None
    gstin: Annotated[str | None, Field(max_length=15)] = None
    pan: Annotated[str | None, Field(max_length=10)] = None
    logo_url: Annotated[str | None, Field(max_length=500)] = None
    primary_color: Annotated[str | None, Field(max_length=7)] = None
    settings: dict[str, Any] | None = None


class TenantRead(GlobalBaseSchema):
    """Schema for reading tenant data."""

    name: str
    slug: str
    domain: str | None
    status: TenantStatus
    subscription_plan: SubscriptionPlan
    settings: dict[str, Any]
    logo_url: str | None
    primary_color: str | None
    contact_email: str | None
    contact_phone: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    country: str | None
    postal_code: str | None
    gstin: str | None
    pan: str | None


class TenantBrief(BaseSchema):
    """Brief tenant schema for nested references."""

    id: uuid.UUID
    name: str
    slug: str
    status: TenantStatus


class TenantSettingsUpdate(BaseSchema):
    """Schema for updating tenant settings."""

    settings: dict[str, Any]


class TenantWithStats(TenantRead):
    """Tenant with statistics."""

    user_count: int = 0
    active_user_count: int = 0