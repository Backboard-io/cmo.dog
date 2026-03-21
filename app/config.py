"""App configuration via pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    backboard_api_key: str = ""
    backboard_assistant_storage: str = ""

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""

    domain_client: str = "http://localhost:8000"
    domain_server: str = "http://localhost:8000"
    free_prompts_limit: int = 5
    admin_emails: str = ""  # comma-separated list of admin email addresses

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


settings = Settings()
