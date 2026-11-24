
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):

    # Database Settings
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    # Email Settings
    BREVO_API_KEY: SecretStr | None = None
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    MAIL_FROM: str
    FRONTEND_URL: str
    REGISTRATION_EMAIL_OTP_ENABLED: bool = False
    
    JWT_SECRET_KEY: str
    JWT_ACCESS_MINUTES: int = 30
    JWT_REFRESH_DAYS: int = 7
    
    GOOGLE_CLIENT_ID: str
    
    STRIPE_SECRET_KEY: str
    STRIPE_PUBLISHABLE_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    STRIPE_UPGRADE_PORTAL_CONFIGURATION_ID: str | None = None
    STRIPE_MANAGEMENT_PORTAL_CONFIGURATION_ID: str | None = None


    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
