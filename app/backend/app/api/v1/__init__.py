"""API v1 module."""

from fastapi import APIRouter

from app.api.v1 import auth, users
from app.finance.router import router as finance_router
from app.invoices.router import router as invoice_router

# Create v1 router
router = APIRouter()

# Include sub-routers
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(users.router, prefix="/users", tags=["Users"])
router.include_router(finance_router)
router.include_router(invoice_router, prefix="/invoices", tags=["Invoices"])


# Future routers will be added here:
# from app.api.v1 import tenants, roles, permissions
# router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
# router.include_router(roles.router, prefix="/roles", tags=["Roles"])
# router.include_router(permissions.router, prefix="/permissions", tags=["Permissions"])

__all__ = ["router"]