# backend/app/routes/quotes.py
# Responsibility: API endpoints for the quote lifecycle.
# Covers: send quote, accept, counter, accept/reject counter.
# Phase 1: Stub router only. No endpoints or logic defined yet.
# server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/quotes",
    tags=["quotes"],
)

 # POST /quotes/ | GET /quotes/{id} | POST /quotes/{id}/accept
# POST /quotes/{id}/counter | POST /quotes/{id}/accept-counter | POST /quotes/{id}/reject-counter
