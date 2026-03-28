# backend/app/config.py
# Responsibility: Application-wide configuration and environment variable loading.
# Phase 1: Structural shell only. No logic migrated yet.
# In future phases, this will load settings from environment variables
# (e.g. DATABASE_URL, SECRET_KEY, JWT settings, Stripe keys).
# server.py remains the active backend — this file is not yet in use.

# from pydantic_settings import BaseSettings  # Uncomment in Phase 2

# class Settings(BaseSettings):
#     database_url: str = ""
#     secret_key: str = ""
#     algorithm: str = "HS256"
#     access_token_expire_minutes: int = 30
#
#     class Config:
#         env_file = ".env"

# settings = Settings()  # Uncomment in Phase 2
