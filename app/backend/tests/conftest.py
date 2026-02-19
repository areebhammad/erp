"""Pytest configuration and fixtures."""

import asyncio
import uuid
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.role import Permission, Role
from app.models.tenant import Tenant
from app.models.user import User

# Test database URL (use SQLite for tests or separate PostgreSQL test DB)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
# Or use PostgreSQL test database:
# TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/erp_test"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session_maker = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    async with async_session_maker() as session:
        yield session


@pytest.fixture(scope="function")
def client(db_session: AsyncSession) -> Generator[TestClient, None, None]:
    """Create test client with database override."""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def test_tenant(db_session: AsyncSession) -> Tenant:
    """Create a test tenant."""
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Test Company",
        slug="test-company",
        status="active",
        subscription_plan="professional",
        settings={},
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession, test_tenant: Tenant) -> User:
    """Create a test user."""
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="test@example.com",
        hashed_password=hash_password("TestPassword123!"),
        first_name="Test",
        last_name="User",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def test_admin_user(db_session: AsyncSession, test_tenant: Tenant) -> User:
    """Create a test admin user."""
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="admin@example.com",
        hashed_password=hash_password("AdminPassword123!"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_verified=True,
        is_superuser=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def test_role(db_session: AsyncSession, test_tenant: Tenant) -> Role:
    """Create a test role."""
    role = Role(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Test Role",
        description="A test role for testing",
        is_system=False,
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest_asyncio.fixture(scope="function")
async def test_permission(db_session: AsyncSession, test_role: Role) -> Permission:
    """Create a test permission."""
    permission = Permission(
        id=uuid.uuid4(),
        role_id=test_role.id,
        resource="users",
        action="read",
    )
    db_session.add(permission)
    await db_session.commit()
    await db_session.refresh(permission)
    return permission


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    """Create authorization headers for test user."""
    from app.core.security import create_access_token
    
    access_token = create_access_token(
        user_id=test_user.id,
        tenant_id=test_user.tenant_id,
        roles=["user"],
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def admin_auth_headers(test_admin_user: User) -> dict[str, str]:
    """Create authorization headers for admin user."""
    from app.core.security import create_access_token
    
    access_token = create_access_token(
        user_id=test_admin_user.id,
        tenant_id=test_admin_user.tenant_id,
        roles=["admin"],
    )
    return {"Authorization": f"Bearer {access_token}"}