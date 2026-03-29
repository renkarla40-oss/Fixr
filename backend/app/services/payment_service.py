# backend/app/services/payment_service.py
# Responsibility: Business logic for payment processing.
# Phase 7: Business logic migrated from server.py. server.py remains the active backend.
# All 9 functions are exact copies from server.py.
# sync_paid_state() is re-homed here from quote_service.py (was _sync_paid_state).
# quote_service.py now imports sync_paid_state from this module.
# FLAGS imported from app.config — no direct os.getenv for MVP_MODE.
# PaymentStatus and QuoteStatus values used as inline strings (no new class).

from bson import ObjectId
from fastapi import HTTPException
from datetime import datetime, timedelta
from typing import Optional
import logging
import os

from app.config import FLAGS

logger = logging.getLogger(__name__)


# =============================================================================
# SYNC_PAID_STATE
# Re-homed from quote_service._sync_paid_state (was private, now public).
# Exact function body from server.py L3613.
# Called by: mark_payment_paid (this file), sandbox_pay_quote (quote_service).
# =============================================================================
async def sync_paid_state(job_id: str, payment_status: str, quote_id: str = None, db=None):
    """
    Sync legacy paid fields when payments.status changes.
    IDEMPOTENT - safe to call multiple times.
    """
    if payment_status != "paid":
        logger.debug(f"[sync_paid_state] Skipping sync for job {job_id}")
        return

    now = datetime.utcnow()
    job = await db.service_requests.find_one({"_id": ObjectId(job_id)})
    if not job:
        logger.warning(f"[sync_paid_state] Job {job_id} not found")
        return

    job_update = {"updatedAt": now}
    if job.get("paymentStatus") != "held":
        job_update["paymentStatus"] = "held"
    if not job.get("paidAt"):
        job_update["paidAt"] = now
    if len(job_update) > 1:
        await db.service_requests.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": job_update}
        )
        logger.info(f"[sync_paid_state] Synced job {job_id}: {list(job_update.keys())}")

    quote_query = {"requestId": job_id, "status": "ACCEPTED"}
    if quote_id:
        quote_query["_id"] = ObjectId(quote_id)
    q = await db.quotes.find_one(quote_query)
    if q and not q.get("paidAt"):
        await db.quotes.update_one(
            {"_id": q["_id"]},
            {"$set": {"paidAt": now}}
        )
        logger.info(f"[sync_paid_state] Synced quote paidAt")

# =============================================================================
# CREATE DRAFT PAYMENT
# Extracted from create_draft_payment() in server.py (~line 3678).
# =============================================================================
async def create_draft_payment(job_id: str, current_user, db):
    """
    Create or return existing draft payment record for a job.
    Amount is computed server-side from the accepted quote.
    """
    # Verify job exists
    job = await db.service_requests.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Verify requester is the customer for this job
    if job.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can create payment for this job")

    # Check for existing payment that is not yet paid
    existing_payment = await db.payments.find_one({
        "jobId": job_id,
        "status": {"$ne": "paid"}
    })

    if existing_payment:
        # Return existing draft/pending payment
        return {
            "paymentId": str(existing_payment["_id"]),
            "amount": existing_payment["amount"],
            "currency": existing_payment["currency"],
            "status": existing_payment["status"]
        }

    # Check if already paid
    paid_payment = await db.payments.find_one({
        "jobId": job_id,
        "status": "paid"
    })
    if paid_payment:
        return {
            "paymentId": str(paid_payment["_id"]),
            "amount": paid_payment["amount"],
            "currency": paid_payment["currency"],
            "status": paid_payment["status"],
            "message": "Payment already completed"
        }

    # Get accepted quote to compute amount
    quote = await db.quotes.find_one({
        "requestId": job_id,
        "status": "ACCEPTED"
    })

    if not quote:
        raise HTTPException(
            status_code=400,
            detail="No accepted quote found for this job. Quote must be accepted before payment."
        )

    # Compute amount from quote (SERVER-SIDE - never trust client)
    SERVICE_FEE_FLAT = 40.00  # TTD flat fee
    job_price = float(quote["amount"])
    total_amount = round(job_price + SERVICE_FEE_FLAT, 2)

    now = datetime.utcnow()

    # Create new payment record
    payment = {
        "jobId": job_id,
        "customerId": current_user.id,
        "providerId": quote.get("providerId"),
        "amount": total_amount,
        "currency": "TTD",
        "status": "draft",
        "gateway": "none",
        "gatewayRef": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.payments.insert_one(payment)
    payment_id = str(result.inserted_id)

    logger.info(f"[PAYMENTS] Created draft payment {payment_id} for job {job_id}, amount={total_amount} TTD")

    return {
        "paymentId": payment_id,
        "amount": total_amount,
        "currency": "TTD",
        "status": "draft"
    }

# =============================================================================
# MARK PAYMENT PAID
# Extracted from mark_payment_paid() in server.py (~line 3773).
# FLAGS imported from app.config — no direct os.getenv for MVP_MODE.
# =============================================================================
async def mark_payment_paid(payment_id: str, current_user, db):
    """
    DEV/SANDBOX ONLY: Mark a payment as paid.
    This simulates payment completion until real gateway is integrated.
    Protected to DEV mode or admin users only.
    """
    # DEV/SANDBOX PROTECTION: Only allow in non-production or for test accounts
    is_dev_mode = FLAGS.MVP_MODE  # In MVP mode, allow sandbox payments
    is_test_account = current_user.email and (
        current_user.email.startswith("test.") or
        current_user.email.endswith("@test.com")
    )

    if not is_dev_mode and not is_test_account:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available in development/sandbox mode"
        )

    # Find payment record
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # IDEMPOTENCY: If already paid, return success
    if payment["status"] == "paid":
        return {
            "success": True,
            "paymentId": payment_id,
            "status": "paid",
            "message": "Payment already completed"
        }

    now = datetime.utcnow()
    job_id = payment["jobId"]

    # Update payment status to PAID (PRIMARY AUTHORITY)
    await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {
            "status": "paid",
            "updatedAt": now
        }}
    )

    # Sync legacy fields (job.paymentStatus, job.paidAt, quote.paidAt)
    await sync_paid_state(job_id, "paid", db=db)

    logger.info(f"[PAYMENTS] Marked payment {payment_id} as PAID for job {job_id}")

    return {
        "success": True,
        "paymentId": payment_id,
        "status": "paid",
        "message": "Payment confirmed (sandbox)"
    }

# =============================================================================
# GET PAYMENT STATUS
# Extracted from get_payment_status() in server.py (~line 3841).
# =============================================================================
async def get_payment_status(job_id: str, current_user, db):
    """
    Get the latest payment record for a job.
    """
    # Verify job exists and user has access
    job = await db.service_requests.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Allow customer or provider to check payment status
    if job.get("customerId") != current_user.id and job.get("providerId") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this job's payment status")

    # Find latest payment for this job
    payment = await db.payments.find_one(
        {"jobId": job_id},
        sort=[("createdAt", -1)]
    )

    if not payment:
        return {
            "paymentId": None,
            "status": "none",
            "amount": None,
            "currency": None,
            "message": "No payment record found"
        }

    return {
        "paymentId": str(payment["_id"]),
        "status": payment["status"],
        "amount": payment["amount"],
        "currency": payment["currency"]
    }


# =============================================================================
# GET PAYMENT BY JOB
# Extracted from get_payment_by_job() in server.py (~line 3881).
# =============================================================================
async def get_payment_by_job(job_id: str, current_user, db):
    """
    Get full payment record for a job (for frontend paid-state authority).
    Returns: { paymentId, status, amount, currency, gateway, updatedAt }
    """
    # Verify job exists and user has access
    job = await db.service_requests.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Allow customer or provider to check payment
    if job.get("customerId") != current_user.id and job.get("providerId") != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this job's payment")

    # Find latest payment for this job
    payment = await db.payments.find_one(
        {"jobId": job_id},
        sort=[("createdAt", -1)]
    )

    if not payment:
        return {
            "paymentId": None,
            "status": None,
            "amount": None,
            "currency": None,
            "gateway": None,
            "updatedAt": None
        }

    return {
        "paymentId": str(payment["_id"]),
        "status": payment["status"],
        "amount": payment["amount"],
        "currency": payment["currency"],
        "gateway": payment.get("gateway"),
        "updatedAt": payment.get("updatedAt").isoformat() if payment.get("updatedAt") else None
    }

# =============================================================================
# GET RECEIPT BY JOB
# Extracted from get_receipt_by_job() in server.py (~line 3928).
# =============================================================================
async def get_receipt_by_job(request_id: str, current_user, db):
    """
    Fetch payment receipt for a job. Only the paying customer can access.
    Returns PaymentTransaction fields needed for receipt UI.
    """
    # Find the payment transaction for this job
    txn = await db.payment_transactions.find_one({"jobId": request_id})

    if not txn:
        raise HTTPException(status_code=404, detail="Receipt not found. Payment may not have been completed.")

    # Auth check: only the customer who paid can view the receipt
    if txn.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own receipts")

    # Return receipt data
    return {
        "transactionId": str(txn["_id"]),
        "paymentProviderTxnId": txn.get("paymentProviderTxnId"),
        "jobId": txn.get("jobId"),
        "quoteId": txn.get("quoteId"),
        "jobPrice": txn.get("jobPrice"),
        "serviceFee": txn.get("serviceFee"),
        "totalPaidByCustomer": txn.get("totalPaidByCustomer"),
        "currency": txn.get("currency", "TTD"),
        "vatEnabled": txn.get("vatEnabled", False),
        "vatRate": txn.get("vatRate", 0),
        "vatTotal": txn.get("vatTotal", 0),
        "status": txn.get("status"),
        "paidAt": txn.get("createdAt").isoformat() if txn.get("createdAt") else None,
    }

# =============================================================================
# GET PROVIDER EARNINGS
# Extracted from get_provider_earnings() in server.py (~line 4092).
# =============================================================================
async def get_provider_earnings(current_user, db):
    """
    Get provider earnings summary (READ-ONLY).
    Calculates totals from existing payment_transactions collection.

    - Held Balance: payments where job is NOT completed yet
    - Available Balance: payments where job IS completed (eligible for future payout)
    - Lifetime Earned: sum of all provider earnings from completed jobs
    """
    # Find provider profile for current user
    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_id = str(provider["_id"])

    # Completed job statuses
    completed_statuses = ["completed", "completed_pending_review", "completed_reviewed"]

    # Get all jobs assigned to this provider with payments
    jobs_cursor = db.service_requests.find({
        "providerId": provider_id,
        "paymentStatus": "held"
    })

    held_balance = 0.0
    available_balance = 0.0
    lifetime_earned = 0.0
    recent_transactions = []

    async for job in jobs_cursor:
        job_id = str(job["_id"])

        # Find payment transaction for this job
        txn = await db.payment_transactions.find_one({"jobId": job_id})
        if not txn:
            continue

        # Provider earnings = jobPrice - commission (net after Fixr commission)
        # jobPrice is the quote amount, commission is Fixr's 10% cut
        job_price = txn.get("jobPrice", 0)
        commission = txn.get("commission", 0)
        provider_earnings = job_price - commission

        job_status = job.get("status", "")

        if job_status in completed_statuses:
            # Job completed - add to available balance and lifetime
            available_balance += provider_earnings
            lifetime_earned += provider_earnings

            recent_transactions.append({
                "jobId": job_id,
                "service": job.get("service", "Service"),
                "jobAmount": job_price,
                "commission": commission,
                "netEarnings": provider_earnings,
                "amount": provider_earnings,  # Keep for backward compatibility
                "currency": txn.get("currency", "TTD"),
                "status": "available",
                "date": txn.get("createdAt"),
                "customerName": job.get("customerName", "Customer"),
            })
        else:
            # Job not yet completed - add to held balance
            held_balance += provider_earnings

            recent_transactions.append({
                "jobId": job_id,
                "service": job.get("service", "Service"),
                "jobAmount": job_price,
                "commission": commission,
                "netEarnings": provider_earnings,
                "amount": provider_earnings,  # Keep for backward compatibility
                "currency": txn.get("currency", "TTD"),
                "status": "held",
                "date": txn.get("createdAt"),
                "customerName": job.get("customerName", "Customer"),
            })

    # Sort recent transactions by date (newest first)
    recent_transactions.sort(key=lambda x: x.get("date") or datetime.min, reverse=True)

    # Format dates for response
    for txn in recent_transactions:
        if txn.get("date"):
            txn["date"] = txn["date"].isoformat() if hasattr(txn["date"], "isoformat") else str(txn["date"])

    return {
        "heldBalance": round(held_balance, 2),
        "availableBalance": round(available_balance, 2),
        "lifetimeEarned": round(lifetime_earned, 2),
        "recentTransactions": recent_transactions[:10],  # Limit to 10 most recent
        "payoutsEnabled": False,  # Payouts not implemented yet
    }

# =============================================================================
# RELEASE PROVIDER PAYOUT
# Extracted from release_provider_payout() in server.py (~line 4205).
# ADMIN-ONLY. verify_admin_token dependency lives in routes/payments.py.
# PAYOUT_BYPASS_24H read via os.getenv — not in config.py FeatureFlags.
# =============================================================================
async def release_provider_payout(request_id: str, db):
    """
    ADMIN-ONLY: Release provider payout for a completed job.

    Requirements:
    - Job must be completed (completedAt exists)
    - No active disputes
    - 24 hours must have passed since completion (unless PAYOUT_BYPASS_24H=true)
    """
    now = datetime.utcnow()

    # 1. Load the job/request
    try:
        request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID format")

    if not request:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Check if job is completed
    completed_at = request.get("completedAt") or request.get("jobCompletedAt")
    if not completed_at:
        return {
            "success": False,
            "errorCode": "NOT_COMPLETED",
            "message": "Job has not been completed yet. Cannot release payout."
        }

    # 3. Load the ProviderPayout linked to this job
    payout = await db.provider_payouts.find_one({"jobId": request_id})
    if not payout:
        return {
            "success": False,
            "errorCode": "NOT_FOUND",
            "message": "Provider payout record not found for this job."
        }

    payout_id = str(payout["_id"])
    current_status = payout.get("status", "pending")

    # 4. Check for active disputes (simple check - look for disputes collection)
    dispute = await db.disputes.find_one({
        "requestId": request_id,
        "status": {"$in": ["open", "pending", "under_review"]}
    })

    if dispute:
        # Set payout to on_hold if not already
        if current_status != "on_hold":
            await db.provider_payouts.update_one(
                {"_id": payout["_id"]},
                {"$set": {"status": "on_hold", "updatedAt": now}}
            )
        return {
            "success": False,
            "errorCode": "DISPUTE_ACTIVE",
            "message": "Cannot release payout. An active dispute exists for this job.",
            "disputeId": str(dispute["_id"])
        }

    # 5. 24-hour hold rule
    bypass_24h = os.getenv("PAYOUT_BYPASS_24H", "false").lower() == "true"

    if isinstance(completed_at, str):
        completed_at = datetime.fromisoformat(completed_at.replace("Z", "+00:00").replace("+00:00", ""))

    hold_end_time = completed_at + timedelta(hours=24)

    if not bypass_24h and now < hold_end_time:
        remaining_seconds = (hold_end_time - now).total_seconds()
        remaining_hours = int(remaining_seconds // 3600)
        remaining_minutes = int((remaining_seconds % 3600) // 60)
        return {
            "success": False,
            "errorCode": "NOT_ELIGIBLE_YET",
            "message": f"Payout not eligible yet. 24-hour hold period has not passed.",
            "completedAt": completed_at.isoformat(),
            "eligibleAt": hold_end_time.isoformat(),
            "remainingTime": f"{remaining_hours}h {remaining_minutes}m"
        }

    # 6. Release payout (idempotent)
    if current_status == "released":
        # Already released - return success (idempotent)
        return {
            "success": True,
            "message": "Payout already released (idempotent)",
            "payoutId": payout_id,
            "status": "released",
            "releasedAt": payout.get("releasedAt").isoformat() if payout.get("releasedAt") else None,
            "amount": payout.get("amount"),
            "currency": payout.get("currency")
        }

    # Update payout status to released
    await db.provider_payouts.update_one(
        {"_id": payout["_id"]},
        {"$set": {
            "status": "released",
            "releasedAt": now,
            "updatedAt": now
        }}
    )

    logger.info(f"Payout released: payoutId={payout_id}, jobId={request_id}, amount={payout.get('amount')} {payout.get('currency')}")

    return {
        "success": True,
        "message": "Payout released successfully",
        "payoutId": payout_id,
        "status": "released",
        "releasedAt": now.isoformat(),
        "amount": payout.get("amount"),
        "currency": payout.get("currency"),
        "providerId": payout.get("providerId")
    }

# =============================================================================
# GET PAYOUT STATUS
# Extracted from get_payout_status() in server.py (~line 4332).
# ADMIN-ONLY. verify_admin_token dependency lives in routes/payments.py.
# =============================================================================
async def get_payout_status(request_id: str, db):
    """
    ADMIN-ONLY: Get payout status for a job.
    """
    payout = await db.provider_payouts.find_one({"jobId": request_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found for this job")

    return {
        "payoutId": str(payout["_id"]),
        "jobId": payout.get("jobId"),
        "providerId": payout.get("providerId"),
        "amount": payout.get("amount"),
        "currency": payout.get("currency"),
        "status": payout.get("status"),
        "createdAt": payout.get("createdAt").isoformat() if payout.get("createdAt") else None,
        "releasedAt": payout.get("releasedAt").isoformat() if payout.get("releasedAt") else None,
        "updatedAt": payout.get("updatedAt").isoformat() if payout.get("updatedAt") else None
    }


# =============================================================================
# GET PAYOUT BY REQUEST
# Extracted from get_payout_by_request() in server.py (~line 4357).
# PROVIDER-ONLY. Authorization checked against provider profile.
# =============================================================================
async def get_payout_by_request(request_id: str, current_user, db):
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
        raise HTTPException(status_code=404, detail="Payout record not found for this job")

    return {
        "payoutId": str(payout["_id"]),
        "jobId": payout.get("jobId"),
        "amount": payout.get("amount"),
        "currency": payout.get("currency"),
        "status": payout.get("status"),
        "releasedAt": payout.get("releasedAt").isoformat() if payout.get("releasedAt") else None,
        "createdAt": payout.get("createdAt").isoformat() if payout.get("createdAt") else None
    }
