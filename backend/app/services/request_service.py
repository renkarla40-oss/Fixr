# backend/app/services/request_service.py
# Responsibility: All service request lifecycle business logic.
# Phase 4: Business logic migrated from server.py. server.py remains the active backend.
# notify_fn is injected by the route layer — service layer has no import from server.py.

from bson import ObjectId
from fastapi import HTTPException
from datetime import datetime
from typing import Optional, Callable
import logging

from app.services.auth_service import generate_job_code
from app.utils.status import normalize_legacy_job
from app.schemas.service_request import ServiceRequest, ServiceRequestResponse, AssignProviderRequest

logger = logging.getLogger(__name__)


# =============================================================================
# CREATE REQUEST
# Extracted from create_service_request() in server.py (~line 4402)
# =============================================================================
async def create_request(request_data: ServiceRequest, provider_id: Optional[str], current_user, db, notify_fn: Optional[Callable] = None) -> ServiceRequestResponse:
    try:
        logger.info(f"Creating service request: {request_data.model_dump()}")
        logger.info(f"Provider ID: {provider_id}")
        is_general_request = provider_id is None or provider_id == "general"

        # General request - no specific provider
        if is_general_request:
            request_dict = {
                "customerId": current_user.id,
                "providerId": None,
                "service": request_data.service,
                "description": request_data.description,
                "preferredDateTime": request_data.preferredDateTime,
                "status": "pending",
                "customerName": current_user.name,
                "customerPhone": current_user.phone,
                "providerName": None,
                "isGeneralRequest": True,
                "subCategory": request_data.subCategory,
                "location": request_data.location,
                "createdAt": datetime.utcnow(),
            }
        else:
            # Specific provider request
            provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
            if not provider:
                raise HTTPException(status_code=404, detail="Provider not found")
            if not provider.get("isAcceptingJobs", True):
                raise HTTPException(
                    status_code=400,
                    detail="Provider unavailable. This Fixr isn't accepting new jobs right now. Please choose another provider."
                )
            provider_user = await db.users.find_one({"_id": ObjectId(provider["userId"])})
            provider_name = provider_user["name"] if provider_user else provider.get("name", "Provider")
            request_dict = {
                "customerId": current_user.id,
                "providerId": provider_id,
                "service": request_data.service,
                "description": request_data.description,
                "preferredDateTime": request_data.preferredDateTime,
                "status": "pending",
                "customerName": current_user.name,
                "customerPhone": current_user.phone,
                "providerName": provider_name,
                "isGeneralRequest": False,
                "subCategory": request_data.subCategory,
                "location": request_data.location,
                "jobTown": request_data.jobTown,
                "createdAt": datetime.utcnow(),
            }

        result = await db.service_requests.insert_one(request_dict)
        request_dict["_id"] = str(result.inserted_id)
        request_id_str = str(result.inserted_id)

        # Customer system message (idempotent)
        customer_message_text = "Fixr: Your request was sent. Providers have up to 24 hours to respond."
        existing_customer_msg = await db.job_messages.find_one({
            "requestId": request_id_str,
            "senderId": "system",
            "senderName": "Fixr",
            "type": "system",
            "text": customer_message_text
        })
        if not existing_customer_msg:
            msg_time = datetime.utcnow()
            customer_system_message = {
                "requestId": request_id_str,
                "senderId": "system",
                "senderName": "Fixr",
                "senderRole": "system",
                "type": "system",
                "text": customer_message_text,
                "targetRole": "customer",
                "createdAt": msg_time,
                "deliveredAt": msg_time,
                "readAt": None,
            }
            await db.job_messages.insert_one(customer_system_message)
            await db.service_requests.update_one(
                {"_id": result.inserted_id},
                {"$set": {"last_message_at": msg_time}}
            )
            logger.info(f"[Request Create] Inserted customer system message for requestId={request_id_str}")

        # Provider system message (idempotent) - only for specific provider requests
        if not is_general_request and provider_id:
            raw_service = request_data.service or ""
            service_name = raw_service.replace("_", " ").title() if raw_service else "a service request"
            if not service_name.strip():
                service_name = "a service request"
            provider_message_text = f"Fixr: You've received a new service request for {service_name}. You have up to 24 hours to accept or decline this request before it expires."
            existing_provider_msg = await db.job_messages.find_one({
                "requestId": request_id_str,
                "senderId": "system",
                "senderName": "Fixr",
                "type": "system",
                "targetRole": "provider"
            })
            if not existing_provider_msg:
                provider_msg_time = datetime.utcnow()
                provider_system_message = {
                    "requestId": request_id_str,
                    "senderId": "system",
                    "senderName": "Fixr",
                    "senderRole": "system",
                    "type": "system",
                    "text": provider_message_text,
                    "targetRole": "provider",
                    "createdAt": provider_msg_time,
                    "deliveredAt": provider_msg_time,
                    "readAt": None,
                }
                await db.job_messages.insert_one(provider_system_message)
                await db.service_requests.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"last_message_at": provider_msg_time}}
                )
                logger.info(f"[Request Create] Inserted provider expectation system message for requestId={request_id_str}")

            # Send push notification to provider
            provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
            if provider:
                provider_user_id = provider.get("userId")
                if provider_user_id and notify_fn:
                    await notify_fn(
                        provider_user_id,
                        "New Job Request",
                        f"{current_user.name} has requested {request_data.service} service",
                        {
                            "type": "request_received",
                            "requestId": str(result.inserted_id),
                            "customerId": current_user.id,
                            "providerId": provider_id,
                        }
                    )

        # Ensure new fields have defaults for response
        request_dict["jobCode"] = request_dict.get("jobCode")
        request_dict["jobStartedAt"] = request_dict.get("jobStartedAt")
        request_dict["jobCompletedAt"] = request_dict.get("jobCompletedAt")
        request_dict["customerReview"] = request_dict.get("customerReview")
        request_dict["customerRating"] = request_dict.get("customerRating")
        request_dict["last_message_at"] = request_dict.get("last_message_at")
        return ServiceRequestResponse(**request_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating service request: {str(e)}")
        raise

# =============================================================================
# LIST REQUESTS
# Extracted from get_service_requests() in server.py (~line 4683)
# =============================================================================
async def list_requests(current_user, db) -> list:
    if current_user.currentRole == "customer":
        query = {"customerId": current_user.id}
    else:
        provider = await db.providers.find_one({"userId": current_user.id})
        if not provider:
            return []
        query = {
            "$or": [
                {"providerId": str(provider["_id"])},
                {
                    "isGeneralRequest": True,
                    "status": "pending",
                    "providerId": None,
                },
            ]
        }

    requests = await db.service_requests.find(query).sort("createdAt", -1).to_list(100)
    result = []
    for req in requests:
        req["_id"] = str(req["_id"])
        if "isGeneralRequest" not in req:
            req["isGeneralRequest"] = False
        if "subCategory" not in req:
            req["subCategory"] = None
        if "location" not in req:
            req["location"] = None
        last_message = await db.job_messages.find_one(
            {"requestId": req["_id"]},
            sort=[("createdAt", -1)]
        )
        if last_message:
            req["last_message_at"] = last_message.get("createdAt")
        else:
            req["last_message_at"] = None
        result.append(ServiceRequestResponse(**req))
    return result


# =============================================================================
# GET REQUEST DETAIL
# Extracted from get_service_request_detail() in server.py (~line 1692)
# =============================================================================
async def get_request_detail(request_id: str, current_user, db):
    try:
        request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Request not found")

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")
    is_general_request = request.get("isGeneralRequest", False)

    if not is_customer and not is_provider and not is_general_request:
        raise HTTPException(status_code=403, detail="Not authorized to view this request")

    request["_id"] = str(request["_id"])
    if request.get("providerId"):
        request["providerId"] = str(request["providerId"])

    request = normalize_legacy_job(request)

    request["jobCode"] = request.get("jobCode")
    request["jobStartedAt"] = request.get("jobStartedAt")
    request["jobCompletedAt"] = request.get("jobCompletedAt")
    request["completionOtp"] = request.get("completionOtp")
    request["customerReview"] = request.get("customerReview")
    request["customerRating"] = request.get("customerRating")
    request["reviewedAt"] = request.get("reviewedAt")
    request["subCategory"] = request.get("subCategory")
    request["location"] = request.get("location")
    request["jobTown"] = request.get("jobTown")
    request["searchRadiusMiles"] = request.get("searchRadiusMiles", 10)
    request["jobDuration"] = request.get("jobDuration")
    request["paymentStatus"] = request.get("paymentStatus", "unpaid")
    request["paidAt"] = request.get("paidAt")

    return request

# =============================================================================
# ACCEPT REQUEST
# Extracted from accept_service_request() in server.py (~line 1748)
# =============================================================================
async def accept_request(request_id: str, current_user, db, notify_fn: Optional[Callable] = None):
    """
    Provider accepts a job request. Generates a job code for arrival confirmation.
    Valid transition: pending -> accepted
    IDEMPOTENT: Returns success if already accepted by same provider.
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
        raise HTTPException(status_code=403, detail="Not authorized - provider profile not found")

    provider_id_str = str(provider["_id"])

    excluded_providers = request.get("excludedProviderIds", [])
    if provider_id_str in excluded_providers:
        raise HTTPException(
            status_code=403,
            detail={"message": "This request is no longer available.", "errorCode": "REQUEST_EXPIRED"}
        )

    request_provider_id = request.get("providerId")
    if request_provider_id and request_provider_id != provider_id_str:
        raise HTTPException(
            status_code=403,
            detail={"message": "This request is no longer available.", "errorCode": "REQUEST_EXPIRED"}
        )

    current_status = request.get("status")
    if current_status == "accepted" and request.get("providerId") == provider_id_str:
        job_code = request.get("jobCode", generate_job_code())
        return {"success": True, "message": "Job accepted", "jobCode": job_code}

    if current_status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot accept request in status: {current_status}")

    job_code = generate_job_code()
    update_fields = {
        "status": "accepted",
        "jobCode": job_code,
        "acceptedAt": datetime.utcnow(),
        "providerId": str(provider["_id"]),
        "providerName": provider.get("name", "Provider"),
    }
    await db.service_requests.update_one({"_id": ObjectId(request_id)}, {"$set": update_fields})
    updated_request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    updated_request["_id"] = str(updated_request["_id"])

    # System message to customer (idempotent)
    existing_accept_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "type": "system",
        "text": {"$regex": "Provider accepted"},
        "targetRole": "customer"
    })
    if not existing_accept_msg:
        msg_time = datetime.utcnow()
        accept_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "system",
            "text": "Fixr: Provider accepted your request.",
            "targetRole": "customer",
            "createdAt": msg_time,
            "deliveredAt": msg_time,
            "readAt": None,
        }
        await db.job_messages.insert_one(accept_message)
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": msg_time}}
        )

    # System message to provider (idempotent)
    existing_provider_accept_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "type": "system",
        "text": {"$regex": "You accepted this job"},
        "targetRole": "provider"
    })
    if not existing_provider_accept_msg:
        prov_accept_time = datetime.utcnow()
        provider_accept_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "system",
            "text": "Fixr: You accepted this job. The customer has been notified. Send a quote when ready.",
            "targetRole": "provider",
            "createdAt": prov_accept_time,
            "deliveredAt": prov_accept_time,
            "readAt": None,
        }
        await db.job_messages.insert_one(provider_accept_message)
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": prov_accept_time}}
        )

    # Send notification to customer
    if notify_fn:
        await notify_fn(
            user_id=updated_request["customerId"],
            title="Request Accepted",
            body=f"Your {updated_request['service']} request was accepted.",
            data={
                "type": "request_accepted",
                "requestId": str(updated_request["_id"]),
            }
        )

    return {"success": True, "message": "Job accepted", "jobCode": job_code}

# =============================================================================
# DECLINE REQUEST
# Extracted from decline_request() in server.py (~line 4733)
# =============================================================================
async def decline_request(request_id: str, current_user, db, notify_fn: Optional[Callable] = None):
    """
    Provider declines a request.
    Valid transition: pending -> declined
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
        raise HTTPException(status_code=403, detail="Not authorized - provider profile not found")

    request_provider_id = request.get("providerId")
    if request_provider_id is not None and str(provider["_id"]) != request_provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to decline this request")

    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "declined", "declinedAt": datetime.utcnow()}}
    )
    updated_request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    updated_request["_id"] = str(updated_request["_id"])

    # System message to customer (idempotent)
    decline_message_text = "This request was declined by the provider. You can submit the request again."
    existing_decline_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "type": "system",
        "text": decline_message_text
    })
    if not existing_decline_msg:
        decline_msg_time = datetime.utcnow()
        decline_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "system",
            "text": decline_message_text,
            "targetRole": "customer",
            "createdAt": decline_msg_time,
            "deliveredAt": decline_msg_time,
            "readAt": None,
        }
        await db.job_messages.insert_one(decline_message)
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": decline_msg_time}}
        )

    # Ensure new fields have defaults
    updated_request["jobCode"] = updated_request.get("jobCode")
    updated_request["startedAt"] = updated_request.get("startedAt")
    updated_request["completedAt"] = updated_request.get("completedAt")
    updated_request["customerReview"] = updated_request.get("customerReview")
    updated_request["customerRating"] = updated_request.get("customerRating")
    updated_request["reviewedAt"] = updated_request.get("reviewedAt")

    # Send notification to customer
    if notify_fn:
        await notify_fn(
            user_id=updated_request["customerId"],
            title="Request Declined",
            body=f"Your {updated_request['service']} request was declined.",
            data={
                "type": "request_declined",
                "requestId": str(updated_request["_id"]),
            }
        )

    return ServiceRequestResponse(**updated_request)


# =============================================================================
# CANCEL REQUEST
# Extracted from cancel_request() in server.py (~line 4817)
# =============================================================================
async def cancel_request(request_id: str, current_user, db, notify_fn: Optional[Callable] = None):
    """
    Customer or provider cancels a request.
    Valid transitions: pending -> cancelled, accepted -> cancelled
    Cannot cancel after in_progress or completed.
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    request_customer_id = str(request.get("customerId", ""))
    is_customer = request_customer_id == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")

    if not is_customer and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this request")

    current_status = request.get("status")
    if current_status in ["in_progress", "completed_pending_review", "completed_reviewed", "completed"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel request in status: {current_status}")

    cancelled_by = "customer" if is_customer else "provider"
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "cancelled", "cancelledAt": datetime.utcnow(), "cancelledBy": cancelled_by}}
    )

    if is_customer:
        try:
            if request.get("providerId"):
                provider_user = await db.providers.find_one({"_id": ObjectId(request["providerId"])})
                if provider_user:
                    notify_user_id = provider_user.get("userId")
                    if notify_user_id and notify_fn:
                        await notify_fn(
                            user_id=notify_user_id,
                            title="Request Cancelled",
                            body=f"A {request['service']} request was cancelled by the customer.",
                            data={"type": "request_cancelled", "requestId": str(request["_id"])}
                        )
        except Exception as e:
            logger.warning(f"Failed to send push notification to provider: {e}")

    if is_provider:
        if notify_fn:
            await notify_fn(
                user_id=request["customerId"],
                title="Request Cancelled",
                body=f"Your {request['service']} request was cancelled by the provider.",
                data={"type": "request_cancelled", "requestId": str(request["_id"])}
            )

        # System message to customer when provider cancels after accepting (idempotent)
        if current_status == "accepted":
            cancel_message_text = "The provider has cancelled this job. You can submit a new request."
            existing_cancel_msg = await db.job_messages.find_one({
                "requestId": request_id,
                "senderId": "system",
                "senderName": "Fixr",
                "type": "system",
                "text": cancel_message_text
            })
            if not existing_cancel_msg:
                provider_cancel_msg_time = datetime.utcnow()
                cancel_message = {
                    "requestId": request_id,
                    "senderId": "system",
                    "senderName": "Fixr",
                    "senderRole": "system",
                    "type": "system",
                    "text": cancel_message_text,
                    "targetRole": "customer",
                    "createdAt": provider_cancel_msg_time,
                    "deliveredAt": provider_cancel_msg_time,
                    "readAt": None,
                }
                await db.job_messages.insert_one(cancel_message)
                await db.service_requests.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"last_message_at": provider_cancel_msg_time}}
                )
                logger.info(f"[Cancel] Inserted system message for provider cancellation, requestId={request_id}")

    return {"success": True, "message": "Request cancelled"}

# =============================================================================
# ASSIGN PROVIDER
# Extracted from assign_provider_to_request() in server.py (~line 1899)
# =============================================================================
async def assign_provider(request_id: str, assign_data: AssignProviderRequest, current_user, db, notify_fn: Optional[Callable] = None):
    """
    Customer selects a provider from the list, assigning them to an existing request.
    Does NOT create a new request — attaches a provider to an existing pending request.
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this request")

    current_status = request.get("status")
    if current_status != "pending":
        raise HTTPException(status_code=400, detail=f"Can only assign provider to pending requests. Current status: {current_status}")

    provider = await db.providers.find_one({"_id": ObjectId(assign_data.providerId)})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    excluded_providers = request.get("excludedProviderIds", [])
    if assign_data.providerId in excluded_providers:
        raise HTTPException(status_code=400, detail="This provider is not available for this request")

    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "providerId": assign_data.providerId,
            "providerName": provider.get("name", "Provider"),
            "providerAssignedAt": datetime.utcnow(),
            "isGeneralRequest": False,
        }}
    )

    # Provider system message (idempotent)
    raw_service = request.get("service", "")
    service_name = raw_service.replace("_", " ").title() if raw_service else "a service request"
    provider_message_text = f"Fixr: You've received a new service request for {service_name}. You have up to 24 hours to accept or decline this request before it expires."
    existing_provider_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "senderId": "system",
        "senderName": "Fixr",
        "type": "system",
        "targetRole": "provider"
    })
    if not existing_provider_msg:
        provider_system_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "system",
            "text": provider_message_text,
            "targetRole": "provider",
            "createdAt": datetime.utcnow(),
            "deliveredAt": datetime.utcnow(),
            "readAt": None,
        }
        await db.job_messages.insert_one(provider_system_message)
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": datetime.utcnow()}}
        )
        logger.info(f"[Assign Provider] Inserted provider system message for requestId={request_id}")

    # Send notification to provider
    if notify_fn:
        await notify_fn(
            user_id=provider["userId"],
            title="New Job Request",
            body=f"{current_user.name} has selected you for a {request.get('service', 'service')} job",
            data={
                "type": "request_received",
                "requestId": request_id,
                "customerId": current_user.id,
                "providerId": assign_data.providerId,
            }
        )

    logger.info(f"Provider {assign_data.providerId} assigned to request {request_id}")
    return {"success": True, "message": "Provider assigned successfully", "requestId": request_id}


# =============================================================================
# RELEASE PROVIDER
# Extracted from release_provider_from_request() in server.py (~line 2015)
# =============================================================================
async def release_provider(request_id: str, current_user, db):
    """
    Customer releases the current provider from a pending request.
    - Adds provider to excludedProviderIds (idempotent, no duplicates)
    - Clears providerId, providerName, providerAssignedAt
    - Sends system messages to both customer and provider
    - Status remains pending so customer can select another provider
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this request")

    current_status = request.get("status")
    if current_status != "pending":
        raise HTTPException(status_code=400, detail=f"Can only release provider from pending requests. Current status: {current_status}")

    current_provider_id = request.get("providerId")
    if not current_provider_id:
        raise HTTPException(status_code=400, detail="No provider assigned to this request")

    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "providerId": None,
                "providerName": None,
                "providerAssignedAt": None,
                "isGeneralRequest": True,
            },
            "$addToSet": {
                "excludedProviderIds": current_provider_id
            }
        }
    )

    now = datetime.utcnow()

    # System message to provider
    provider_msg = {
        "requestId": request_id,
        "senderId": "system",
        "senderName": "Fixr",
        "senderRole": "system",
        "type": "system",
        "text": "The customer selected another provider.",
        "targetRole": "provider",
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(provider_msg)

    # System message to customer
    customer_msg = {
        "requestId": request_id,
        "senderId": "system",
        "senderName": "Fixr",
        "senderRole": "system",
        "type": "system",
        "text": "You can now choose another provider.",
        "targetRole": "customer",
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(customer_msg)

    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"last_message_at": now}}
    )

    logger.info(f"Provider {current_provider_id} released from request {request_id} by customer")
    return {"success": True, "message": "Provider released. You can now select another provider.", "requestId": request_id}
