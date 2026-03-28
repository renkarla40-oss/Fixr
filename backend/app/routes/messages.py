# backend/app/routes/messages.py
# Responsibility: API endpoints for human chat messages ONLY.
# System job updates belong in request_events.py — NOT here.
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/messages",
    tags=["messages"],
)

 # GET /messages/{request_id} | POST /messages/{request_id} | POST /messages/{request_id}/read
