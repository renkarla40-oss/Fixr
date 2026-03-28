# backend/app/routes/provider.py
# Responsibility: API route definitions for provider-facing endpoints.
# Phase 3: Read-domain structure preparation.
#
# This file defines the APIRouter instance only.
# No endpoint decorators (@router.get, etc.) are defined in this phase.
# No handlers, no logic, no DB calls.
#
# All provider endpoints currently live in server.py and remain there.
# This router is NOT mounted — it is not reachable by any request.
#
# Intended endpoints to be implemented in a future phase:
#   GET   /api/providers                  — list/search providers (directory)
#   GET   /api/providers/{provider_id}    — get single provider detail
#   GET   /api/providers/me               — get current provider profile (auth required)
#   PATCH /api/providers/me/availability  — update provider availability status
#   POST  /api/providers/me/setup         — complete provider profile setup

from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["provider"],
)

# Endpoint implementations to be added in a future phase.
# Logic will be migrated from server.py provider route handlers.
# server.py remains the active backend until switch-over is approved.
