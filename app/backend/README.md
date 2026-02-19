# AI-First ERP Backend

A modern, multi-tenant ERP backend built with FastAPI, SQLAlchemy, and PostgreSQL.

## Features

- **Multi-Tenant Architecture**: Shared tables with `tenant_id` column for efficient multi-tenancy
- **JWT Authentication**: RS256-signed tokens with access/refresh token flow
- **Role-Based Access Control (RBAC)**: Flexible permission system
- **Event-Driven Architecture**: Redis pub/sub for cross-module communication
- **Background Jobs**: Redis Queue (RQ) for async processing
- **Audit Logging**: Comprehensive audit trail for compliance
- **AI Integration Ready**: Interfaces for Azure OpenAI and Qdrant vector DB

## Tech Stack

- **Framework**: FastAPI (Python 3.13+)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Migrations**: Alembic
- **Cache/Queue**: Redis
- **Auth**: JWT with RS256 signing
- **Validation**: Pydantic v2

## Project Structure

```
app/
backend/
  app/
    api/              # API endpoints
      deps.py           # FastAPI dependencies
      v1/               # API version 1
        auth.py           # Authentication endpoints
        users.py          # User management endpoints
    core/             # Core configuration
      config.py          # Settings and configuration
      constants.py       # Enums and constants
      database.py        # Database connection
      events.py          # Event bus
      exceptions.py      # Custom exceptions
      redis.py           # Redis client
      security.py        # Auth utilities
    models/           # SQLAlchemy models
      audit_log.py       # Audit log model
      base.py            # Base model classes
      role.py            # Role and Permission models
      tenant.py          # Tenant model
      user.py            # User model
    schemas/          # Pydantic schemas
      base.py            # Base schemas
      role.py            # Role schemas
      tenant.py          # Tenant schemas
      user.py            # User schemas
    main.py           # FastAPI application
  alembic/            # Database migrations
  tests/              # Test suite
```

## Getting Started

### Prerequisites

- Python 3.13+
- PostgreSQL 15+
- Redis 7+

### Installation

1. Create a virtual environment:
```bash
cd app/backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -e ".[dev]"
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Generate RSA keys for JWT:
```bash
mkdir keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

5. Run database migrations:
```bash
alembic upgrade head
```

6. Start the development server:
```bash
uvicorn app.main:app --reload
```

### API Documentation

Once running, access the API documentation at:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Development

### Running Tests

```bash
pytest
```

### Code Quality

```bash
# Run linter
ruff check .

# Run formatter
ruff format .

# Run type checker
mypy .
```

### Pre-commit Hooks

```bash
pre-commit install
pre-commit run --all-files
```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/password-reset/request` - Request password reset
- `POST /api/v1/auth/password-reset/confirm` - Confirm password reset

### Users
- `GET /api/v1/users/me` - Get current user
- `PATCH /api/v1/users/me` - Update current user
- `POST /api/v1/users/me/change-password` - Change password
- `GET /api/v1/users` - List users (admin)
- `POST /api/v1/users` - Create user (admin)
- `GET /api/v1/users/{id}` - Get user by ID (admin)
- `PATCH /api/v1/users/{id}` - Update user (admin)
- `DELETE /api/v1/users/{id}` - Delete user (admin)

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_PRIVATE_KEY_PATH`: Path to RSA private key
- `JWT_PUBLIC_KEY_PATH`: Path to RSA public key
- `SECRET_KEY`: Application secret key

## License

Proprietary - All rights reserved.