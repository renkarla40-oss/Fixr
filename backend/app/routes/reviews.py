# backend/app/routes/reviews.py
# Responsibility: API endpoints for customer reviews after job completion.
# Review only allowed after successful completion. No duplicate reviews per request.
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
)

 # POST /reviews/ | GET /reviews/{provider_id} | GET /reviews/request/{request_id}
