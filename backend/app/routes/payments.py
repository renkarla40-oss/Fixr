# backend/app/routes/payments.py
# Responsibility: API endpoints for payment processing.
# Payment must occur before the provider starts the job (protected behavior).
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/payments",
    tags=["payments"],
)

 # POST /payments/initiate | POST /payments/confirm | GET /payments/{request_id}/status
