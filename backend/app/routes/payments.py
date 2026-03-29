# backend/app/routes/payments.py
# Responsibility: API endpoints for payment processing, receipts, earnings, and payouts.
# Phase 7: Routes migrated from server.py. server.py remains the active backend.
# Router uses NO prefix — all paths declared explicitly in full (matches server.py exactly).
# verify_admin_token is an exact extraction from server.py L4195.
# Routes delegate all business logic to payment_service.

from fastapi import APIRouter, Depends, Query, Header, HTTPException

from app.dependencies import get_current_user
from app.schemas.payment import CreateDraftPaymentRequest, MarkPaidRequest
from app.services import payment_service
from app.database import get_db


# =============================================================================
# ADMIN TOKEN DEPENDENCY
# Exact extraction from verify_admin_token() in server.py (~line 4195).
# =============================================================================
def verify_admin_token(x_admin_token: str = Header(None)):
    """Verify admin token from header"""
    import os
    admin_token = os.getenv("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(status_code=500, detail="Admin token not configured")
    if not x_admin_token or x_admin_token != admin_token:
        raise HTTPException(status_code=401, detail="Invalid or missing admin token")
    return True


router = APIRouter(
    tags=["payments"],
)


# =============================================================================
# POST /payments/create-draft
# =============================================================================
@router.post("/payments/create-draft")
async def create_draft_payment(
    request: CreateDraftPaymentRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.create_draft_payment(request.jobId, current_user, db)


# =============================================================================
# POST /payments/mark-paid
# =============================================================================
@router.post("/payments/mark-paid")
async def mark_payment_paid(
    request: MarkPaidRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.mark_payment_paid(request.paymentId, current_user, db)


# =============================================================================
# GET /payments/status
# =============================================================================
@router.get("/payments/status")
async def get_payment_status(
    jobId: str = Query(..., description="Job ID to check payment status"),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.get_payment_status(jobId, current_user, db)


# =============================================================================
# GET /payments/by-job
# =============================================================================
@router.get("/payments/by-job")
async def get_payment_by_job(
    jobId: str = Query(..., description="Job ID to get payment details"),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.get_payment_by_job(jobId, current_user, db)


# =============================================================================
# GET /receipts/by-job/{request_id}
# =============================================================================
@router.get("/receipts/by-job/{request_id}")
async def get_receipt_by_job(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.get_receipt_by_job(request_id, current_user, db)


# =============================================================================
# GET /providers/me/earnings
# =============================================================================
@router.get("/providers/me/earnings")
async def get_provider_earnings(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.get_provider_earnings(current_user, db)


# =============================================================================
# POST /payouts/release/{request_id}  (ADMIN-ONLY)
# =============================================================================
@router.post("/payouts/release/{request_id}")
async def release_provider_payout(
    request_id: str,
    _admin: bool = Depends(verify_admin_token),
    db=Depends(get_db),
):
    return await payment_service.release_provider_payout(request_id, db)


# =============================================================================
# GET /payouts/status/{request_id}  (ADMIN-ONLY)
# =============================================================================
@router.get("/payouts/status/{request_id}")
async def get_payout_status(
    request_id: str,
    _admin: bool = Depends(verify_admin_token),
    db=Depends(get_db),
):
    return await payment_service.get_payout_status(request_id, db)


# =============================================================================
# GET /payouts/by-request/{request_id}  (PROVIDER-ONLY)
# =============================================================================
@router.get("/payouts/by-request/{request_id}")
async def get_payout_by_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await payment_service.get_payout_by_request(request_id, current_user, db)
