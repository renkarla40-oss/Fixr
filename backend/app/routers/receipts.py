from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from ..database import db
from ..auth import get_current_user
from ..models import User

router = APIRouter()


@router.get("/receipts/by-job/{request_id}")
async def get_receipt_by_job(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Fetch payment receipt for a job. Only the paying customer can access.
    Returns PaymentTransaction fields needed for receipt UI.
    Ported verbatim from server.py.
    """
    txn = await db.payment_transactions.find_one({"jobId": request_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Receipt not found. Payment may not have been completed.")
    if txn.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own receipts")
    return {
        "transactionId": str(txn["_id"]),
        "paymentProviderTxnId": txn.get("paymentProviderTxnId"),
        "jobId": txn.get("jobId"),
        "quoteId": txn.get("quoteId"),
        "jobPrice": txn.get("jobPrice"),
        "commission": txn.get("commission"),
        "serviceFee": txn.get("serviceFee"),
        "totalPaidByCustomer": txn.get("totalPaidByCustomer"),
        "currency": txn.get("currency", "TTD"),
        "vatEnabled": txn.get("vatEnabled", False),
        "vatRate": txn.get("vatRate", 0),
        "vatTotal": txn.get("vatTotal", 0),
        "status": txn.get("status"),
        "paidAt": txn.get("createdAt").isoformat() if txn.get("createdAt") else None,
    }
