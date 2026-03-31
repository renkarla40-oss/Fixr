from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime

from ..database import db
from ..auth import get_current_user
from ..models import User

router = APIRouter()


def _ts(val) -> str | None:
      """Convert a datetime or ISO string to ISO-8601 string, or return None."""
      if val is None:
                return None
            if isinstance(val, datetime):
                      return val.isoformat()
                  return str(val)


@router.get("/service-requests/{request_id}/activity")
async def get_service_request_activity(
      request_id: str,
      current_user: User = Depends(get_current_user),
):
      """
          Return a chronological activity log derived from the service-request document.
              This endpoint is NOT present in server.py — it was introduced in commit c5e2214.
                  Each entry has: { type, timestamp, actor, description }
                      """
    try:
              oid = ObjectId(request_id)
except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req = await db.service_requests.find_one({"_id": oid})
    if not req:
              raise HTTPException(status_code=404, detail="Service request not found")

    # Authorization: only the customer or assigned provider may view activity
    user_id = str(current_user.id) if hasattr(current_user, "id") else current_user.get("_id") or current_user.get("id")
    customer_id = str(req.get("customerId", ""))
    provider_id = str(req.get("providerId", ""))
    if str(user_id) not in (customer_id, provider_id):
              raise HTTPException(status_code=403, detail="Not authorized to view this activity")

    events = []

    # 1. Created
    created_at = req.get("createdAt")
    if created_at:
              events.append({
                            "type": "created",
                            "timestamp": _ts(created_at),
                            "actor": customer_id,
                            "description": "Service request created",
              })

    # 2. Provider accepted / job assigned
    accepted_at = req.get("acceptedAt")
    if accepted_at and provider_id:
              events.append({
                            "type": "accepted",
                            "timestamp": _ts(accepted_at),
                            "actor": provider_id,
                            "description": "Provider accepted the request",
              })

    # 3. Provider arrived on site
    arrived_at = req.get("arrivedAt")
    if arrived_at:
              events.append({
                            "type": "arrived",
                            "timestamp": _ts(arrived_at),
                            "actor": provider_id,
                            "description": "Provider confirmed arrival on site",
              })

    # 4. Quote sent (first quote creation time from quotes collection)
    first_quote = await db.quotes.find_one(
              {"requestId": request_id},
              sort=[("createdAt", 1)],
    )
    if first_quote:
              events.append({
                            "type": "quote_sent",
                            "timestamp": _ts(first_quote.get("createdAt")),
                            "actor": provider_id,
                            "description": "Quote sent to customer",
              })

    # 5. Quote accepted
    accepted_quote = await db.quotes.find_one(
              {"requestId": request_id, "status": "accepted"},
              sort=[("updatedAt", 1)],
    )
    if accepted_quote:
              events.append({
                            "type": "quote_accepted",
                            "timestamp": _ts(accepted_quote.get("updatedAt") or accepted_quote.get("createdAt")),
                            "actor": customer_id,
                            "description": "Customer accepted the quote",
              })

    # 6. Payment recorded
    payment = await db.payments.find_one({"jobId": request_id})
    if payment:
              paid_at = payment.get("paidAt") or payment.get("createdAt")
              events.append({
                  "type": "payment_made",
                  "timestamp": _ts(paid_at),
                  "actor": customer_id,
                  "description": "Payment recorded",
              })

    # 7. Job completed
    completed_at = req.get("completedAt")
    if completed_at:
              events.append({
                            "type": "completed",
                            "timestamp": _ts(completed_at),
                            "actor": provider_id,
                            "description": "Job marked as completed",
              })

    # 8. Review submitted
    review = await db.reviews.find_one({"requestId": request_id})
    if review:
              events.append({
                            "type": "reviewed",
                            "timestamp": _ts(review.get("createdAt")),
                            "actor": customer_id,
                            "description": "Customer submitted a review",
              })

    # 9. Cancelled
    cancelled_at = req.get("cancelledAt")
    if cancelled_at:
              events.append({
                            "type": "cancelled",
                            "timestamp": _ts(cancelled_at),
                            "actor": req.get("cancelledBy", customer_id),
                            "description": "Service request cancelled",
              })

    # Sort by timestamp ascending; entries with None timestamp go last
    def sort_key(e):
              ts = e.get("timestamp")
              return ts if ts else "9999"

    events.sort(key=sort_key)

    return events
