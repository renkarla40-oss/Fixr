# backend/app/routes/request_events.py
# Responsibility: API endpoints for system-generated request lifecycle events ONLY.
# Human chat messages belong in messages.py — NOT here.
# Phase 11: GET /service-requests/{request_id}/activity endpoint added.
# NO prefix on this router — path declared explicitly to match API convention.
# Matches pattern of messages.py (no prefix, full explicit paths).

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.database import get_db
from app.services import request_event_service

# NO prefix — path declared explicitly
router = APIRouter(
    tags=["request_events"],
)


@router.get("/service-requests/{request_id}/activity")
async def get_activity_feed(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_event_service.get_events(db=db, request_id=request_id)
