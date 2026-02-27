"""Core configuration module using Pydantic Settings."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.constants import Environment


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ==========================================================================
    # Application Settings
    # ==========================================================================
    app_name: str = "AI-First ERP"
    app_env: Environment = Environment.DEVELOPMENT
    debug: bool = False
    secret_key: str = Field(..., min_length=32)

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.app_env == Environment.PRODUCTION

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.app_env == Environment.DEVELOPMENT

    @property
    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self.app_env == Environment.TESTING

    # ==========================================================================
    # API Settings
    # ==========================================================================
    api_v1_prefix: str = "/api/v1"
    cors_origins_str: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        alias="CORS_ORIGINS",
    )
    cors_allow_credentials: bool = True

    @property
    def cors_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [o.strip() for o in self.cors_origins_str.split(",") if o.strip()]

    # ==========================================================================
    # Database Settings
    # ==========================================================================
    database_url: str = Field(..., description="PostgreSQL connection URL")
    database_pool_size: int = Field(default=20, ge=1, le=100)
    database_max_overflow: int = Field(default=10, ge=0, le=50)
    database_echo: bool = False

    @property
    def async_database_url(self) -> str:
        """Get async database URL (asyncpg driver)."""
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url

    # ==========================================================================
    # Redis Settings
    # ==========================================================================
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_cache_ttl: int = Field(default=300, description="Default cache TTL in seconds")

    # ==========================================================================
    # JWT Settings
    # ==========================================================================
    jwt_private_key_path: Path = Field(default=Path("./keys/private.pem"))
    jwt_public_key_path: Path = Field(default=Path("./keys/public.pem"))
    jwt_algorithm: str = "RS256"
    jwt_access_token_expire_minutes: int = Field(default=15, ge=1)
    jwt_refresh_token_expire_days: int = Field(default=7, ge=1)

    @property
    def jwt_private_key(self) -> str:
        """Load JWT private key from file."""
        return self.jwt_private_key_path.read_text()

    @property
    def jwt_public_key(self) -> str:
        """Load JWT public key from file."""
        return self.jwt_public_key_path.read_text()

    # ==========================================================================
    # AI/ML Settings
    # ==========================================================================
    azure_openai_api_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_api_version: str = "2024-02-01"
    azure_openai_gpt4_deployment: str = "gpt-4"
    azure_openai_gpt35_deployment: str = "gpt-35-turbo"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    google_api_key: str | None = None

    # ==========================================================================
    # Vector Database Settings
    # ==========================================================================
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None

    # ==========================================================================
    # Object Storage Settings (SeaweedFS — S3-compatible, Apache 2.0)
    # boto3/aiobotocore connects via endpoint_url=seaweedfs_s3_endpoint.
    # In production, point these at AWS S3 or any S3-compatible service.
    # ==========================================================================
    seaweedfs_s3_endpoint: str = "http://localhost:8333"
    aws_access_key_id: str = "erp_dev"
    aws_secret_access_key: str = "erp_secret"
    s3_bucket_name: str = "erp-files"
    s3_secure: bool = False

    # ==========================================================================
    # Email Settings
    # ==========================================================================
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None

    # ==========================================================================
    # Logging Settings
    # ==========================================================================
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "text"] = "json"

    # ==========================================================================
    # Rate Limiting
    # ==========================================================================
    rate_limit_requests: int = Field(default=100, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)



@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()