# backend/app/routes/service_requests.py
# Responsibility: API endpoints for the service request lifecycle.
# Phase 4: Route handlers wired to request_service business logic.
# Route prefix corrected to /service-requests to match server.py exactly.
# send_push_notification imported here (route layer only) and injected into service calls.
# No business logic lives in this file — handlers are thin wrappers only.
# server.py remains the active backend throughout Phase 4.

from fastapi import APIRouter, Depends, Query
from typing import List, Optional

from server import send_push_notification

from app.dependencies import get_current_user
from app.database import get_db
from app.services import request_service
from app.schemas.service_request import ServiceRequest, ServiceRequestResponse, AssignProviderRequest

router = APIRouter(
    prefix="/service-requests",
    tags=["service_requests"],
)


@router.post("", response_model=ServiceRequestResponse)
async def create_service_request(
    request_data: ServiceRequest,
    provider_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.create_request(
        request_data=request_data,
        provider_id=provider_id,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.get("", response_model=List[ServiceRequestResponse])
async def get_service_requests(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.list_requests(
        current_user=current_user,
        db=db,
    )


@router.get("/{request_id}")
async def get_service_request_detail(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.get_request_detail(
        request_id=request_id,
        current_user=current_user,
        db=db,
    )


@router.patch("/{request_id}/accept")
async def accept_service_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.accept_request(
        request_id=request_id,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.patch("/{request_id}/decline", response_model=ServiceRequestResponse)
async def decline_service_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.decline_request(
        request_id=request_id,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.patch("/{request_id}/cancel")
async def cancel_service_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.cancel_request(
        request_id=request_id,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.patch("/{request_id}/assign-provider")
async def assign_provider_to_request(
    request_id: str,
    assign_data: AssignProviderRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.assign_provider(
        request_id=request_id,
        assign_data=assign_data,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.patch("/{request_id}/release-provider")
async def release_provider_from_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await request_service.release_provider(
        request_id=request_id,
        current_user=current_user,
        db=db,
    )
