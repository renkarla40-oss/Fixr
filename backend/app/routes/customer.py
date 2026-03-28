# backend/app/routes/customer.py
# Responsibility: API route definitions for customer-facing endpoints.
# Phase 3: Read-domain structure preparation.
#
# This file defines the APIRouter instance only.
# No endpoint decorators (@router.get, etc.) are defined in this phase.
# No handlers, no logic, no DB calls.
#
# All customer endpoints currently live in server.py and remain there.
# This router is NOT mounted — it is not reachable by any request.
#
# Intended endpoints to be implemented in a future phase:
#   GET   /api/users/profile   — get current customer profile
#   PATCH /api/users/profile   — update current customer profile
#   PATCH /api/users/role      — switch active role (customer/provider)
#   GET   /api/towns           — list available towns/locations

from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["customer"],
)

# Endpoint implementations to be added in a future phase.
# Logic will be migrated from server.py customer/user route handlers.
# server.py remains the active backend until switch-over is approved.
