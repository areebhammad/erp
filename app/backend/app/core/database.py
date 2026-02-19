"""Database configuration and session management."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

if TYPE_CHECKING:
    from uuid import UUID


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


# Create async engine with connection pooling
engine: AsyncEngine = create_async_engine(
    settings.async_database_url,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    echo=settings.database_echo,
    pool_pre_ping=True,  # Verify connections before use
)

# Use NullPool for testing to avoid connection issues
if settings.is_testing:
    engine = create_async_engine(
        settings.async_database_url,
        poolclass=NullPool,
        echo=settings.database_echo,
    )

# Session factory
async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session.
    
    Usage in FastAPI:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for database sessions outside of FastAPI dependencies.
    
    Usage:
        async with get_db_context() as db:
            result = await db.execute(query)
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection() -> bool:
    """Check if database connection is healthy."""
    try:
        async with async_session_factory() as session:
            await session.execute("SELECT 1")
        return True
    except Exception:
        return False


def set_tenant_context(session: AsyncSession, tenant_id: "UUID") -> None:
    """
    Set tenant context for Row-Level Security.
    
    This sets the PostgreSQL session variable that RLS policies use
    to filter data by tenant.
    """
    # Execute SET command to configure session variable
    session.execute(
        "SET app.current_tenant_id = :tenant_id",
        {"tenant_id": str(tenant_id)},
    )


# Event listener to reset tenant context after session ends
@event.listens_for(AsyncSession, "after_commit")
def reset_tenant_context(session: AsyncSession) -> None:
    """Reset tenant context after transaction commit."""
    session.execute("RESET app.current_tenant_id")


@event.listens_for(AsyncSession, "after_rollback")
def reset_tenant_context_on_rollback(session: AsyncSession) -> None:
    """Reset tenant context after transaction rollback."""
    session.execute("RESET app.current_tenant_id")