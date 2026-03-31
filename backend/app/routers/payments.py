from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from ..database import db
from ..auth import get_current_user
from ..models import User

router = APIRouter()


@router.get("/payments/by-job")
async def get_payment_by_job(
    jobId: str = Query(..., description="Job ID to get payment details"),
    current_user: User = Depends(get_current_user),
):
    """
    Get full payment record for a job (for frontend paid-state authority).
    Returns: { paymentId, status, amount, currency, gateway, updatedAt }
    Ported verbatim from server.py.
    """
    job = await db.service_requests.find_one({"_id": ObjectId(jobId)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("customerId") != current_user.id and job.get("providerId") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this job's payment")
    payment = await db.payments.find_one(
        {"jobId": jobId},
        sort=[("createdAt", -1)],
    )
    if not payment:
        return {
            "paymentId": None,
            "status": None,
            "amount": None,
            "currency": None,
            "gateway": None,
            "updatedAt": None,
        }
    return {
        "paymentId": str(payment["_id"]),
        "status": payment["status"],
        "amount": payment["amount"],
        "currency": payment["currency"],
        "gateway": payment.get("gateway"),
        "updatedAt": payment.get("updatedAt").isoformat() if payment.get("updatedAt") else None,
    }
