# backend/app/routes/quotes.py
# Responsibility: API endpoints for the quote lifecycle.
# Phase 5: Route handlers wired to quote_service business logic.
# No business logic lives in this file — handlers are thin wrappers only.
# No server.py imports needed — quote handlers have no push notifications.
# server.py remains the active backend throughout Phase 5.

from fastapi import APIRouter, Depends
from typing import Optional

from app.dependencies import get_current_user
from app.database import get_db
from app.services import quote_service

router = APIRouter(
    prefix="/quotes",
    tags=["quotes"],
)


@router.post("")
async def create_quote(
    quote_data: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.create_quote(
        quote_data=quote_data,
        current_user=current_user,
        db=db,
    )


@router.post("/{quote_id}/send")
async def send_quote(
    quote_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.send_quote(
        quote_id=quote_id,
        current_user=current_user,
        db=db,
    )


@router.patch("/{quote_id}/revise")
async def revise_quote(
    quote_id: str,
    revision_data: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.revise_quote(
        quote_id=quote_id,
        revision_data=revision_data,
        current_user=current_user,
        db=db,
    )


@router.post("/{quote_id}/reject")
async def reject_quote(
    quote_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.reject_quote(
        quote_id=quote_id,
        current_user=current_user,
        db=db,
    )


@router.post("/{quote_id}/counter")
async def counter_quote(
    quote_id: str,
    counter_data: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.counter_quote(
        quote_id=quote_id,
        counter_data=counter_data,
        current_user=current_user,
        db=db,
    )


@router.get("/by-request/{request_id}")
async def get_quote_by_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.get_quote_by_request(
        request_id=request_id,
        current_user=current_user,
        db=db,
    )


@router.post("/{quote_id}/accept")
async def accept_quote(
    quote_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.accept_quote(
        quote_id=quote_id,
        current_user=current_user,
        db=db,
    )


@router.post("/{quote_id}/sandbox-pay")
async def sandbox_pay_quote(
    quote_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await quote_service.sandbox_pay_quote(
        quote_id=quote_id,
        current_user=current_user,
        db=db,
    )
