"""Base Pydantic schemas for the ERP system."""

import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,  # Enable ORM mode
        populate_by_name=True,  # Allow population by field name
        use_enum_values=True,  # Use enum values instead of enum objects
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None,
            uuid.UUID: lambda v: str(v) if v else None,
        },
    )


class GlobalBaseSchema(BaseSchema):
    """Base schema for global (non-tenant-scoped) entities."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class TenantScopedSchema(GlobalBaseSchema):
    """Base schema for tenant-scoped entities."""

    tenant_id: uuid.UUID
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""

    page: Annotated[int, Field(ge=1, description="Page number")] = 1
    page_size: Annotated[int, Field(ge=1, le=100, description="Items per page")] = 20

    @property
    def offset(self) -> int:
        """Calculate offset for database query."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """Get limit for database query."""
        return self.page_size


class CursorPaginationParams(BaseModel):
    """Cursor-based pagination parameters for large datasets."""

    cursor: uuid.UUID | None = None
    limit: Annotated[int, Field(ge=1, le=100, description="Number of items")] = 20


class PaginatedResponse(BaseSchema):
    """Generic paginated response wrapper."""

    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[Any],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse":
        """Create a paginated response."""
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


class CursorPaginatedResponse(BaseSchema):
    """Cursor-based paginated response for large datasets."""

    items: list[Any]
    next_cursor: uuid.UUID | None
    has_more: bool


class MessageResponse(BaseSchema):
    """Simple message response."""

    message: str


class ErrorResponse(BaseSchema):
    """Error response following RFC 7807 Problem Details format."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    errors: list[dict[str, Any]] | None = None


class HealthCheckResponse(BaseSchema):
    """Health check response."""

    status: str = "healthy"
    version: str = "0.1.0"
    database: str = "connected"
    redis: str = "connected"