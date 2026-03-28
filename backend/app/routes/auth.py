# backend/app/routes/auth.py
# Responsibility: API route definitions for authentication endpoints.
# Phase 3: Read-domain structure preparation.
#
# This file defines the APIRouter instance only.
# No endpoint decorators (@router.get, etc.) are defined in this phase.
# No handlers, no logic, no DB calls.
#
# All auth endpoints currently live in server.py and remain there.
# This router is NOT mounted — it is not reachable by any request.
#
# Intended endpoints to be implemented in a future phase:
#   POST /api/auth/signup    — register a new user
#   POST /api/auth/login     — authenticate and return JWT token
#   GET  /api/auth/me        — return current authenticated user
#   POST /api/auth/social    — social/OAuth login flow

from fastapi import APIRouter

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)

# Endpoint implementations to be added in a future phase.
# Logic will be migrated from server.py auth route handlers.
# server.py remains the active backend until switch-over is approved.
