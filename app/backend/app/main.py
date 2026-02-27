"""Main FastAPI application for AI-First ERP Backend."""

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.constants import Environment
from app.core.database import check_database_connection
from app.schemas.base import ErrorResponse, HealthCheckResponse

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")
    
    # Check database connection
    if await check_database_connection():
        logger.info("Database connection established")
    else:
        logger.error("Failed to connect to database")
        if settings.is_production:
            raise RuntimeError("Database connection failed")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.app_name}")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="AI-First ERP Backend API - Multi-Tenant Architecture",
    version="0.1.0",
    docs_url="/api/docs" if settings.is_development else None,
    redoc_url="/api/redoc" if settings.is_development else None,
    openapi_url="/api/openapi.json" if settings.is_development else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID to all requests for tracing."""
    import uuid
    
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all unhandled exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    
    error_response = ErrorResponse(
        type="https://httpstatuses.com/500",
        title="Internal Server Error",
        status=500,
        detail=str(exc) if settings.debug else "An unexpected error occurred",
        instance=str(request.url),
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response.model_dump(exclude_none=True),
    )


# Health check endpoint
@app.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["Health"],
    summary="Health check endpoint",
    description="Check if the API and its dependencies are healthy",
)
async def health_check() -> HealthCheckResponse:
    """
    Health check endpoint.
    
    Returns the health status of the API and its dependencies.
    """
    db_status = "connected" if await check_database_connection() else "disconnected"
    
    return HealthCheckResponse(
        status="healthy",
        version="0.1.0",
        database=db_status,
        redis="not_configured",  # Will be updated when Redis is configured
    )


# Root endpoint
@app.get(
    "/",
    tags=["Root"],
    summary="API root endpoint",
    description="Returns basic API information",
)
async def root() -> dict[str, str]:
    """Root endpoint returning API information."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/api/docs" if settings.is_development else "disabled",
    }


# Include API routers
from app.api.v1 import router as v1_router

app.include_router(v1_router, prefix=settings.api_v1_prefix)

# Import handlers to register event bus subscribers
import app.finance.handlers  # noqa: F401



def main() -> None:
    """Run the application with uvicorn."""
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()