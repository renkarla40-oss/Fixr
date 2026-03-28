# backend/app/routes/request_events.py
# Responsibility: API endpoints for system-generated request lifecycle events ONLY.
# Human chat messages belong in messages.py — NOT here.
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/request-events",
    tags=["request_events"],
)

 # GET /request-events/{request_id} | POST /request-events/{request_id}/read
