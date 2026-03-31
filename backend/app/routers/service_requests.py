import random
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from ..database import db
from ..auth import get_current_user
from ..models import User, ServiceRequest, ServiceRequestResponse, ConfirmJobStartRequest, SubmitReviewRequest, AssignProviderRequest

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_STATUS_TRANSITIONS = {
      "pending": ["accepted"],
      "accepted": ["awaiting_payment"],
      "awaiting_payment": ["in_progress"],
      "in_progress": ["completed_pending_review"],
      "completed_pending_review": ["completed_reviewed"],
      "completed_reviewed": [],
      "completed": ["completed_pending_review", "completed_reviewed"],
}


def generate_job_code() -> str:
      return str(random.randint(100000, 999999))


def normalize_job(job: dict) -> dict:
      if not job:
                return job
            if job.get("status") == "paid":
                      job["status"] = "awaiting_payment"
                      job["paymentStatus"] = "held"
                  if "paymentStatus" not in job:
                            job["paymentStatus"] = "unpaid"
                        return job


def serialize_request(r: dict) -> dict:
      r = r.copy()
    r["_id"] = str(r["_id"])
    return normalize_job(r)


@router.post("/service-requests", response_model=ServiceRequestResponse)
async def create_service_request(
      request_data: ServiceRequest,
      provider_id: Optional[str] = Query(None),
      current_user: User = Depends(get_current_user)
):
      try:
                is_general = provider_id is None or request_data.service == "Other Services"

        if provider_id:
                      try:
                                        provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
except Exception:
                provider = None
            if not provider:
                              raise HTTPException(status_code=404, detail="Provider not found")
                          provider_name = provider.get("name", "Unknown Provider")
else:
            provider = None
              provider_name = None

        search_radius = request_data.searchRadiusMiles or int(request_data.searchDistanceKm / 1.60934)

        request_dict = {
                      "customerId": current_user.id,
                      "customerName": current_user.name,
                      "customerPhone": current_user.phone,
                      "providerId": provider_id,
                      "providerName": provider_name,
                      "service": request_data.service,
                      "description": request_data.description,
                      "preferredDateTime": request_data.preferredDateTime,
                      "subCategory": request_data.subCategory,
                      "location": request_data.location,
                      "jobTown": request_data.jobTown,
                      "searchRadiusMiles": search_radius,
                      "searchDistanceKm": request_data.searchDistanceKm,
                      "jobDuration": request_data.jobDuration,
                      "status": "pending",
                      "paymentStatus": "unpaid",
                      "isGeneralRequest": is_general,
                      "createdAt": datetime.utcnow(),
                      "updatedAt": datetime.utcnow(),
        }

        if provider:
                      request_dict["providerPhotoUrl"] = provider.get("profilePhotoUrl")

        result = await db.service_requests.insert_one(request_dict)
        request_dict["_id"] = str(result.inserted_id)
        return ServiceRequestResponse(**request_dict)

except HTTPException:
        raise
except Exception as e:
        logger.error(f"Create request error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create service request")


@router.get("/service-requests", response_model=List[ServiceRequestResponse])
async def get_service_requests(current_user: User = Depends(get_current_user)):
      if current_user.currentRole == "customer":
                query = {"customerId": current_user.id}
      else:
        provider = await db.providers.find_one({"userId": current_user.id})
        if not provider:
                      return []
                  provider_id = str(provider["_id"])
        query = {"providerId": provider_id}

    requests = await db.service_requests.find(query).sort("createdAt", -1).to_list(length=100)
    result = []
    for r in requests:
              r = serialize_request(r)
              try:
                            result.append(ServiceRequestResponse(**r))
except Exception:
            pass
    return result


@router.get("/service-requests/{request_id}")
async def get_service_request_detail(request_id: str, current_user: User = Depends(get_current_user)):
      try:
                request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
      except Exception:
        raise HTTPException(status_code=404, detail="Request not found")
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    request = serialize_request(request)

    # Check access
    provider = await db.providers.find_one({"userId": current_user.id})
    provider_id = str(provider["_id"]) if provider else None
    if request["customerId"] != current_user.id and request.get("providerId") != provider_id:
              raise HTTPException(status_code=403, detail="Access denied")

    return request


@router.patch("/service-requests/{request_id}/accept")
async def accept_service_request(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
              raise HTTPException(status_code=403, detail="Provider profile required")
          provider_id = str(provider["_id"])

    # Idempotency: already accepted by this provider
    if request.get("status") == "accepted" and request.get("providerId") == provider_id:
              request = serialize_request(request)
              return request

    if request.get("status") != "pending":
              raise HTTPException(status_code=400, detail=f"Cannot accept request in status: {request.get('status')}")

    job_code = generate_job_code()
    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {
                            "status": "accepted",
                            "providerId": provider_id,
                            "providerName": provider.get("name"),
                            "providerPhotoUrl": provider.get("profilePhotoUrl"),
                            "jobCode": job_code,
                            "acceptedAt": datetime.utcnow(),
                            "updatedAt": datetime.utcnow(),
              }}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.patch("/service-requests/{request_id}/assign-provider")
async def assign_provider(request_id: str, assign_data: AssignProviderRequest, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")
          if request.get("customerId") != current_user.id:
                    raise HTTPException(status_code=403, detail="Only customer can assign provider")

    try:
              provider = await db.providers.find_one({"_id": ObjectId(assign_data.providerId)})
except Exception:
        provider = None
    if not provider:
              raise HTTPException(status_code=404, detail="Provider not found")

    job_code = generate_job_code()
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
              {"$set": {
                            "providerId": assign_data.providerId,
                            "providerName": provider.get("name"),
                            "providerPhotoUrl": provider.get("profilePhotoUrl"),
                            "status": "accepted",
                            "jobCode": job_code,
                            "acceptedAt": datetime.utcnow(),
                            "updatedAt": datetime.utcnow(),
              }}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.patch("/service-requests/{request_id}/release-provider")
async def release_provider(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")
          if request.get("customerId") != current_user.id:
                    raise HTTPException(status_code=403, detail="Only customer can release provider")
                if request.get("status") not in ["accepted"]:
                          raise HTTPException(status_code=400, detail="Cannot release provider at this stage")

    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {
                            "providerId": None,
                            "providerName": None,
                            "status": "pending",
                            "jobCode": None,
                            "updatedAt": datetime.utcnow(),
              }}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.post("/service-requests/{request_id}/confirm-arrival")
async def confirm_arrival(request_id: str, confirm_data: ConfirmJobStartRequest, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
              raise HTTPException(status_code=403, detail="Provider profile required")
          provider_id = str(provider["_id"])

    if request.get("providerId") != provider_id:
              raise HTTPException(status_code=403, detail="Not the assigned provider")
          if request.get("status") != "awaiting_payment":
                    raise HTTPException(status_code=400, detail=f"Cannot start job in status: {request.get('status')}")

    if request.get("paymentStatus") != "held":
              raise HTTPException(status_code=400, detail="Payment must be confirmed before starting job")

    if request.get("jobCode") and confirm_data.jobCode != request.get("jobCode"):
              raise HTTPException(status_code=400, detail="Invalid job code")

    completion_code = generate_job_code()
    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {
                            "status": "in_progress",
                            "completionCode": completion_code,
                            "startedAt": datetime.utcnow(),
                            "updatedAt": datetime.utcnow(),
              }}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.patch("/service-requests/{request_id}/complete")
async def complete_request(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
              raise HTTPException(status_code=403, detail="Provider profile required")
          provider_id = str(provider["_id"])

    if request.get("providerId") != provider_id:
              raise HTTPException(status_code=403, detail="Not the assigned provider")
          if request.get("status") != "in_progress":
                    raise HTTPException(status_code=400, detail=f"Cannot complete job in status: {request.get('status')}")

    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
        {"$set": {
                      "status": "completed_pending_review",
                      "completedAt": datetime.utcnow(),
                      "updatedAt": datetime.utcnow(),
        }}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.post("/service-requests/{request_id}/review")
async def submit_review(request_id: str, review_data: SubmitReviewRequest, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")
          if request.get("customerId") != current_user.id:
                    raise HTTPException(status_code=403, detail="Only customer can submit review")
                if request.get("status") not in ["completed_pending_review", "completed", "completed_reviewed"]:
                          raise HTTPException(status_code=400, detail="Job must be completed to submit review")

    provider_id = request.get("providerId")
    if not provider_id:
              raise HTTPException(status_code=400, detail="No provider assigned")

    # Check for existing review
    existing = await db.reviews.find_one({"jobId": request_id, "customerId": current_user.id})
    if not existing:
              review_doc = {
                            "jobId": request_id,
                            "providerId": provider_id,
                            "customerId": current_user.id,
                            "customerName": current_user.name,
                            "rating": review_data.rating,
                            "comment": review_data.comment,
                            "createdAt": datetime.utcnow(),
              }
              await db.reviews.insert_one(review_doc)

    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {"status": "completed_reviewed", "updatedAt": datetime.utcnow()}}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.post("/service-requests/{request_id}/skip-review")
async def skip_review(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")
          if request.get("customerId") != current_user.id:
                    raise HTTPException(status_code=403, detail="Only customer can skip review")

    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {"status": "completed_reviewed", "reviewSkipped": True, "updatedAt": datetime.utcnow()}}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.patch("/service-requests/{request_id}/decline")
async def decline_request(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    if request.get("status") != "pending":
              raise HTTPException(status_code=400, detail=f"Cannot decline request in status: {request.get('status')}")

    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {"status": "declined", "updatedAt": datetime.utcnow()}}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)


@router.patch("/service-requests/{request_id}/cancel")
async def cancel_request(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    cancellable = ["pending", "accepted"]
    if request.get("status") not in cancellable:
              raise HTTPException(status_code=400, detail=f"Cannot cancel request in status: {request.get('status')}")

    # Both customer and provider can cancel
    provider = await db.providers.find_one({"userId": current_user.id})
    provider_id = str(provider["_id"]) if provider else None
    is_customer = request.get("customerId") == current_user.id
    is_provider = provider_id and request.get("providerId") == provider_id

    if not is_customer and not is_provider:
              raise HTTPException(status_code=403, detail="Access denied")

    await db.service_requests.update_one(
              {"_id": ObjectId(request_id)},
              {"$set": {"status": "cancelled", "cancelledAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}}
    )
    updated = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_request(updated)
