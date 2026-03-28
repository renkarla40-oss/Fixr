# backend/app/routes/service_requests.py
# Responsibility: API endpoints for the service request lifecycle.
# Covers: create, list, detail, accept, decline, cancel, change provider, timeout.
# Phase 1: Stub router only. No endpoints or logic defined yet.
# server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/requests",
    tags=["service_requests"],
)

 # POST /requests/ | GET /requests/ | GET /requests/{id}
# POST /requests/{id}/accept | POST /requests/{id}/decline | POST /requests/{id}/cancel
