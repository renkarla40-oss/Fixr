# backend/app/schemas/payment.py
# Responsibility: Pydantic request/response schemas for Payment endpoints.
# Phase 7: Schemas migrated from server.py. server.py remains the active backend.
# CreateDraftPaymentRequest and MarkPaidRequest are exact copies from server.py L3672-L3676.

from pydantic import BaseModel


class CreateDraftPaymentRequest(BaseModel):
    jobId: str


class MarkPaidRequest(BaseModel):
    paymentId: str
