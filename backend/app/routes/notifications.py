# backend/app/routes/notifications.py
# Responsibility: API endpoints for the notification center (bell notifications).
# Notification unread is separate from chat unread and request event unread.
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)

 # GET /notifications/ | POST /notifications/{id}/read | POST /notifications/read-all
