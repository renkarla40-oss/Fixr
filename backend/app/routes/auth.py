# backend/app/routes/auth.py
# Responsibility: API endpoints for authentication (register, login, token refresh).
# Phase 1: Stub router only. No endpoints or logic defined yet.
# Logic will be migrated from server.py in a future phase.
# server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

# Endpoints will be added in a future phase.
# POST /auth/register
# POST /auth/login
# POST /auth/refresh
# POST /auth/logout
