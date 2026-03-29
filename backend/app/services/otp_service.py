# backend/app/services/otp_service.py
# Responsibility: Business logic for OTP job execution (start and completion).
# Phase 8: Job execution logic migrated from server.py. server.py remains the active backend.
# Covers confirm_job_arrival (job START) and complete_service_request (job COMPLETE).
# Phone OTP (send-otp / verify) is NOT in scope — that belongs to the provider auth domain.
# generate_job_code() is an exact extraction from server.py L76-78.
# notify_fn injected at route layer — no server.py import in this file.
# NotificationType values used as inline strings (no new class).

from bson import ObjectId
from fastapi import HTTPException
from datetime import datetime
from typing import Callable, Optional
import random
import logging

from app.utils.status import get_status_display_name

logger = logging.getLogger(__name__)


# =============================================================================
# GENERATE_JOB_CODE
# Exact extraction from generate_job_code() in server.py L76-78.
# Used in legacy backfill path of confirm_job_arrival.
# =============================================================================
def generate_job_code() -> str:
    """Generate a 6-digit job confirmation code"""
    return str(random.randint(100000, 999999))


# =============================================================================
# CONFIRM JOB ARRIVAL (Job START)
# Extracted from confirm_job_arrival() in server.py (~line 2108).
# Transition: awaiting_payment -> in_progress
# Requires paymentStatus == 'held' before allowing start.
# =============================================================================
async def confirm_job_arrival(request_id: str, confirm_data, current_user, db, notify_fn: Callable):
    """
    Provider enters the job code from customer to confirm arrival and start the job.
    Valid transition: awaiting_payment -> in_progress (payment must be confirmed first)
    IDEMPOTENT: Returns success if already in_progress.
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify the current user is the provider
    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider or str(provider["_id"]) != request.get("providerId"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # IDEMPOTENCY: If already in_progress, return success
    current_status = request.get("status")
    if current_status == "in_progress":
        return {"success": True, "message": "Job already started", "errorCode": "ALREADY_IN_PROGRESS"}

    # Check if already completed
    if current_status == "completed":
        raise HTTPException(
            status_code=400,
            detail={"message": "Job already completed", "errorCode": "ALREADY_COMPLETED"}
        )

    # STATE MACHINE: Can only start from awaiting_payment status
    if current_status != "awaiting_payment":
        raise HTTPException(
            status_code=400,
            detail=f"Job must be in 'awaiting_payment' status before it can be started. Current status: {get_status_display_name(current_status)}"
        )

    # Check payment status - must have funds held in escrow before starting
    payment_status = request.get("paymentStatus", "unpaid")
    if payment_status != "held":
        raise HTTPException(
            status_code=400,
            detail="Payment must be confirmed and held in escrow before starting the job."
        )

    # Get stored job code - handle missing codes for older jobs
    stored_code = request.get("jobCode")

    # If no job code exists (legacy job), generate and save one
    if not stored_code:
        logger.warning(f"[JOB_CODE] Job {request_id} has no jobCode - generating one now (legacy backfill)")
        stored_code = generate_job_code()
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"jobCode": stored_code}}
        )
        # Return error so customer can see the newly generated code
        raise HTTPException(
            status_code=400,
            detail=f"Job code was not previously generated. A new code has been created. Please ask the customer to refresh and provide the new code."
        )
    # Normalize both values for comparison
    stored_code_normalized = str(stored_code).strip()
    input_code_normalized = str(confirm_data.jobCode).strip() if confirm_data.jobCode else ""

    # DEV LOGS for debugging
    logger.info(f"[JOB_CODE_VALIDATION] jobId={request_id}")
    logger.info(f"[JOB_CODE_VALIDATION] stored_code (jobCode field) = '{stored_code_normalized}'")
    logger.info(f"[JOB_CODE_VALIDATION] input_code = '{input_code_normalized}'")
    logger.info(f"[JOB_CODE_VALIDATION] match = {stored_code_normalized == input_code_normalized}")

    # Compare normalized strings
    if stored_code_normalized != input_code_normalized:
        logger.warning(f"[JOB_CODE_VALIDATION] MISMATCH for job {request_id}: stored='{stored_code_normalized}' vs input='{input_code_normalized}'")
        raise HTTPException(status_code=400, detail="Incorrect code. Please ask the customer for the correct code.")

    logger.info(f"[JOB_CODE_VALIDATION] SUCCESS for job {request_id}")

    # Generate completion OTP (6-digit code)
    completion_otp = str(random.randint(100000, 999999))

    # Mark job as in_progress and set completion OTP
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "in_progress",
            "startedAt": datetime.utcnow(),
            "jobStartedAt": datetime.utcnow(),
            "completionOtp": completion_otp
        }}
    )

    # IDEMPOTENT: Add "Fixr" system messages about Completion OTP (role-specific)
    # Customer message - tells them OTP is ready to share
    existing_customer_otp_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "senderName": "Fixr",
        "targetRole": "customer",
        "text": {"$regex": "Completion OTP is ready"}
    })

    if not existing_customer_otp_msg:
        customer_otp_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "text",
            "text": "Fixr: Completion OTP is ready. Please check Details to share it when the job is completed.",
            "targetRole": "customer",
            "createdAt": datetime.utcnow(),
            "deliveredAt": datetime.utcnow(),
            "readAt": None,
        }
        await db.job_messages.insert_one(customer_otp_message)
        # Update last_message_at for unread tracking
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": datetime.utcnow()}}
        )

    # Provider message - tells them to ask customer for the code
    existing_provider_otp_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "senderName": "Fixr",
        "targetRole": "provider",
        "text": {"$regex": "ask the customer for the 6-digit"}
    })

    if not existing_provider_otp_msg:
        provider_otp_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "text",
            "text": "Fixr: When the job is complete, ask the customer for the 6-digit completion code to mark the job complete.",
            "targetRole": "provider",
            "createdAt": datetime.utcnow(),
            "deliveredAt": datetime.utcnow(),
            "readAt": None,
        }
        await db.job_messages.insert_one(provider_otp_message)
        # Update last_message_at for unread tracking
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": datetime.utcnow()}}
        )

    # Send notification to customer
    await notify_fn(
        user_id=request["customerId"],
        title="Job Started",
        body=f"Your {request['service']} job has started.",
        data={
            "type": "job_started",
            "requestId": str(request["_id"]),
        }
    )

    return {"success": True, "message": "Job started successfully"}

# =============================================================================
# COMPLETE SERVICE REQUEST (Job COMPLETE)
# Extracted from complete_service_request() in server.py (~line 2274).
# Transition: in_progress -> completed_pending_review
# Chat stays open — review system handles final state.
# =============================================================================
async def complete_service_request(request_id: str, completion_data: dict, current_user, db, notify_fn: Callable):
    """
    Provider marks the job as completed by entering the completion OTP.
    Valid transition: in_progress -> completed_pending_review
    IDEMPOTENT: Returns success if already completed.

    NEW STATE MACHINE:
    - Job transitions to 'completed_pending_review' (NOT 'completed')
    - Chat stays OPEN until customer submits review
    - Customer is prompted to leave review or skip
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify the current user is the provider
    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider or str(provider["_id"]) != request.get("providerId"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # IDEMPOTENCY: If already in a completed state, return success
    current_status = request.get("status")
    if current_status in ["completed_pending_review", "completed_reviewed", "completed"]:
        return {"success": True, "message": "Job already completed", "errorCode": "ALREADY_COMPLETED", "status": current_status}

    # STATE MACHINE: Can only complete from in_progress
    if current_status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Job must be in progress before it can be completed. Current status: {get_status_display_name(current_status)}"
        )

    # Verify completion OTP
    submitted_otp = completion_data.get("completionOtp", "").strip()
    stored_otp = request.get("completionOtp")

    if not submitted_otp:
        raise HTTPException(status_code=400, detail="Completion OTP is required")

    if submitted_otp != stored_otp:
        raise HTTPException(status_code=400, detail="Incorrect completion code. Please ask the customer for the correct code.")

    # Mark job as completed_pending_review (NEW: Chat stays open!)
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "completed_pending_review",
            "completedAt": datetime.utcnow(),
            "jobCompletedAt": datetime.utcnow()
        }}
    )

    # Add system message about job completion (chat still open)
    # Check if completion message already exists to prevent duplicates
    existing_completion_msg = await db.job_messages.find_one({
        "requestId": request_id,
        "type": "system",
        "text": {"$regex": "job is now complete"}
    })

    if not existing_completion_msg:
        completion_message = {
            "requestId": request_id,
            "senderId": "system",
            "senderName": "System",
            "senderRole": "system",
            "type": "system",
            "text": "\u2705 This job is now complete. Please leave a review for your provider.",
            "targetRole": "customer",  # Only show to customer
            "createdAt": datetime.utcnow(),
            "deliveredAt": datetime.utcnow(),
            "readAt": None,
        }
        await db.job_messages.insert_one(completion_message)
        # Update last_message_at for unread tracking
        await db.service_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"last_message_at": datetime.utcnow()}}
        )

    # Update provider's completed jobs count
    await db.providers.update_one(
        {"_id": provider["_id"]},
        {"$inc": {"completedJobsCount": 1}}
    )

    # Send notification to customer - prompt to review
    await notify_fn(
        user_id=request["customerId"],
        title="Job Completed - Leave a Review",
        body=f"Your {request['service']} job has been completed. Please leave a review for your provider.",
        data={
            "type": "job_completed",
            "requestId": str(request["_id"]),
            "providerId": str(provider["_id"]),
            "customerId": request["customerId"],
        }
    )

    # Send notification to provider (self-confirmation)
    await notify_fn(
        user_id=provider["userId"],
        title="Job Completed",
        body=f"You've completed the {request['service']} job for {request.get('customerName', 'the customer')}.",
        data={
            "type": "job_completed",
            "requestId": str(request["_id"]),
            "providerId": str(provider["_id"]),
            "customerId": request["customerId"],
        }
    )

    return {"success": True, "message": "Job completed successfully"}
