from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from ..database import db
from ..auth import get_current_user
from ..models import User

router = APIRouter()


@router.get("/payouts/by-request/{request_id}")
async def get_payout_by_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    PROVIDER-ONLY: Get payout status for a job (read-only display).
    Authorization: current user must be the provider assigned to this job.
    """
    # 1. Get the service request to verify provider ownership
    job = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Get provider profile for current user
    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
        raise HTTPException(status_code=403, detail="Not authorized - provider profile not found")

    # 3. Verify current user is the provider for this job
    if str(provider["_id"]) != job.get("providerId"):
        raise HTTPException(status_code=403, detail="Not authorized - you are not the provider for this job")

    # 4. Get the payout record
    payout = await db.provider_payouts.find_one({"jobId": request_id})
    if not payout:
        # Return null response (not an error - payout may not exist yet)
        return {
            "exists": False,
            "message": "Payout information will appear here once available."
        }

    # 5. Return payout info for display
    return {
        "exists": True,
        "payoutId": str(payout["_id"]),
        "jobId": payout.get("jobId"),
        "amount": payout.get("amount"),
        "currency": payout.get("currency", "TTD"),
        "status": payout.get("status"),
        "releasedAt": payout.get("releasedAt").isoformat() if payout.get("releasedAt") else None,
        "createdAt": payout.get("createdAt").isoformat() if payout.get("createdAt") else None
    }
