"""Pydantic schemas for Role and Permission models."""

import uuid
from typing import Annotated

from pydantic import Field

from app.core.constants import ActionType
from app.schemas.base import BaseSchema, GlobalBaseSchema, TenantScopedSchema


class PermissionBase(BaseSchema):
    """Base schema for Permission."""

    resource: Annotated[str, Field(min_length=1, max_length=100)]
    action: ActionType


class PermissionCreate(PermissionBase):
    """Schema for creating a permission."""

    role_id: uuid.UUID


class PermissionRead(GlobalBaseSchema):
    """Schema for reading permission data."""

    role_id: uuid.UUID
    resource: str
    action: ActionType


class RoleBase(BaseSchema):
    """Base schema for Role."""

    name: Annotated[str, Field(min_length=1, max_length=100)]
    description: str | None = None


class RoleCreate(RoleBase):
    """Schema for creating a role."""

    is_system: bool = False
    permissions: list[PermissionBase] = Field(default_factory=list)


class RoleUpdate(BaseSchema):
    """Schema for updating a role."""

    name: Annotated[str | None, Field(min_length=1, max_length=100)] = None
    description: str | None = None


class RoleRead(TenantScopedSchema):
    """Schema for reading role data."""

    name: str
    description: str | None
    is_system: bool


class RoleBrief(BaseSchema):
    """Brief role schema for nested references."""

    id: uuid.UUID
    name: str


class RoleWithPermissions(RoleRead):
    """Role with permissions included."""

    permissions: list[PermissionRead] = Field(default_factory=list)


class RoleAssignment(BaseSchema):
    """Schema for assigning roles to users."""

    user_id: uuid.UUID
    role_ids: list[uuid.UUID]


class PermissionCheck(BaseSchema):
    """Schema for checking permissions."""

    resource: str
    action: ActionType


class PermissionGrant(BaseSchema):
    """Schema for granting permissions to a role."""

    role_id: uuid.UUID
    permissions: list[PermissionBase]


class PermissionRevoke(BaseSchema):
    """Schema for revoking permissions from a role."""

    role_id: uuid.UUID
    permission_ids: list[uuid.UUID]