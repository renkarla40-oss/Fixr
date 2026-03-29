# backend/app/services/quote_service.py
# Responsibility: All quote lifecycle business logic.
# Phase 5: Business logic migrated from server.py. server.py remains the active backend.
# All 8 functions are exact copies from server.py.
# No push notifications in any quote handler — notify_fn not used.
# QuoteStatus and PaymentStatus values used as inline strings (no new class).
# _sync_paid_state() is a private helper — exact extraction from server.py L3613.

from bson import ObjectId
from fastapi import HTTPException
from datetime import datetime
from typing import Optional
import logging

from app.utils.status import get_status_display_name

logger = logging.getLogger(__name__)


# =============================================================================
# _SYNC_PAID_STATE (private)
# Exact extraction from sync_paid_state() in server.py (~line 3613).
# Called only by sandbox_pay_quote().
# =============================================================================
async def _sync_paid_state(job_id: str, payment_status: str, quote_id: str = None, db=None):
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
# CREATE QUOTE
# Extracted from create_quote() in server.py (~line 2868).
# =============================================================================
async def create_quote(quote_data: dict, current_user, db):
    """Provider creates a quote for a job."""
    request_id = quote_data.get("requestId")
    if not request_id:
        raise HTTPException(status_code=400, detail="requestId is required")

    # Validate amount
    amount = quote_data.get("amount", 0)
    try:
        amount = float(amount)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    # Validate and trim note
    note = quote_data.get("note", "") or ""
    note = note.strip()[:500] if note else ""

    # Verify provider owns this request
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider or str(provider["_id"]) != request.get("providerId"):
        raise HTTPException(status_code=403, detail="Only the assigned provider can create quotes")

    now = datetime.utcnow()
    quote = {
        "requestId": request_id,
        "customerId": request["customerId"],
        "providerId": str(provider["_id"]),
        "providerUserId": current_user.id,
        "title": quote_data.get("title", "Service Quote"),
        "description": quote_data.get("description", ""),
        "amount": amount,
        "currency": quote_data.get("currency", "TTD"),
        "note": note,
        "status": "DRAFT",
        "revision": 1,
        "counterAmount": None,
        "counterNote": None,
        "createdAt": now,
        "sentAt": None,
        "acceptedAt": None,
        "rejectedAt": None,
        "counteredAt": None,
        "paidAt": None,
    }

    result = await db.quotes.insert_one(quote)
    quote["_id"] = str(result.inserted_id)

    return {"success": True, "quote": quote}

# =============================================================================
# SEND QUOTE
# Extracted from send_quote() in server.py (~line 2928).
# =============================================================================
async def send_quote(quote_id: str, current_user, db):
    """
    Provider sends the quote to customer. Changes status to SENT.
    STATE MACHINE: Cannot send quotes if job is already paid/in_progress/completed.
    IDEMPOTENT: If quote already SENT, return success.
    Can resend after COUNTERED or REJECTED (increments revision).
    """
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Verify sender is the provider
    if quote.get("providerUserId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quote creator can send it")

    # IDEMPOTENCY: If already sent, return success
    if quote["status"] == "SENT":
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote}

    # Cannot revise/resend accepted quotes - quote lifecycle ends at ACCEPTED
    if quote["status"] == "ACCEPTED":
        raise HTTPException(
            status_code=400,
            detail={"message": "Quote already accepted, cannot revise", "errorCode": "ALREADY_ACCEPTED"}
        )

    # Valid states to send from: DRAFT, COUNTERED, REJECTED
    if quote["status"] not in ["DRAFT", "COUNTERED", "REJECTED"]:
        raise HTTPException(status_code=400, detail={"message": f"Cannot send quote with status {quote['status']}", "errorCode": "INVALID_STATUS"})

    # STATE MACHINE: Check job status - cannot send quote if job is beyond accepted
    request = await db.service_requests.find_one({"_id": ObjectId(quote["requestId"])})
    if request:
        current_status = request.get("status")
        if current_status in ["in_progress", "completed"]:
            raise HTTPException(
                status_code=400,
                detail={"message": f"Cannot send quote: job is already {get_status_display_name(current_status)}", "errorCode": "INVALID_STATUS"}
            )

    now = datetime.utcnow()

    # Increment revision if resending after counter/reject
    current_revision = quote.get("revision", 1)
    if quote["status"] in ["COUNTERED", "REJECTED"]:
        current_revision += 1

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {
            "status": "SENT",
            "sentAt": now,
            "revision": current_revision,
            # Clear counter fields on resend
            "counterAmount": None,
            "counterNote": None,
            "counteredAt": None,
            "rejectedAt": None,
        }}
    )

    # Update request status to awaiting_payment
    await db.service_requests.update_one(
        {"_id": ObjectId(quote["requestId"])},
        {"$set": {"status": "awaiting_payment", "updatedAt": now}}
    )

    # Send a system message in chat about the quote
    request = await db.service_requests.find_one({"_id": ObjectId(quote["requestId"])})
    provider = await db.providers.find_one({"_id": ObjectId(quote["providerId"])})
    provider_name = "Provider"
    if provider:
        provider_user = await db.users.find_one({"_id": ObjectId(provider["userId"])})
        if provider_user:
            provider_name = provider_user.get("name", "Provider")

    revision_text = f" (Revision {current_revision})" if current_revision > 1 else ""
    quote_message = {
        "requestId": quote["requestId"],
        "senderId": current_user.id,
        "senderName": provider_name,
        "senderRole": "provider",
        "type": "quote",
        "text": f"Quote sent{revision_text}: {quote['title']} - ${quote['amount']:.2f} {quote['currency']}",
        "quoteId": quote_id,
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(quote_message)

    # CRITICAL: Update last_message_at for unread tracking (customer should see red dot)
    await db.service_requests.update_one(
        {"_id": ObjectId(quote["requestId"])},
        {"$set": {"last_message_at": now}}
    )

    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])

    return {"success": True, "quote": updated_quote}

# =============================================================================
# REVISE QUOTE
# Extracted from revise_quote() in server.py (~line 3035).
# =============================================================================
async def revise_quote(quote_id: str, revision_data: dict, current_user, db):
    """
    Provider revises a quote (updates amount and/or note) before resending.
    Can only revise quotes in COUNTERED or REJECTED status.
    Does NOT automatically send - provider must call /send after revision.
    """
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Only provider can revise
    if quote.get("providerUserId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quote creator can revise it")

    # Can only revise countered or rejected quotes
    if quote["status"] not in ["COUNTERED", "REJECTED", "DRAFT"]:
        raise HTTPException(
            status_code=400,
            detail={"message": f"Cannot revise quote with status {quote['status']}", "errorCode": "INVALID_STATUS"}
        )

    # Cannot revise accepted quotes
    if quote["status"] == "ACCEPTED":
        raise HTTPException(
            status_code=400,
            detail={"message": "Quote already accepted, cannot revise", "errorCode": "ALREADY_ACCEPTED"}
        )

    update_fields = {}

    # Validate and update amount if provided
    if "amount" in revision_data:
        try:
            amount = float(revision_data["amount"])
            if amount <= 0:
                raise HTTPException(status_code=400, detail="Amount must be greater than 0")
            update_fields["amount"] = amount
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid amount")

    # Validate and update note if provided
    if "note" in revision_data:
        note = revision_data["note"] or ""
        update_fields["note"] = note.strip()[:500]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updatedAt"] = datetime.utcnow()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": update_fields}
    )

    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])

    return {"success": True, "quote": updated_quote}


# =============================================================================
# REJECT QUOTE
# Extracted from reject_quote() in server.py (~line 3100).
# =============================================================================
async def reject_quote(quote_id: str, current_user, db):
    """
    Customer rejects a quote.
    IDEMPOTENT: If already rejected, return success.
    Can only reject SENT quotes.
    """
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Only customer can reject
    if quote["customerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can reject quotes")

    # IDEMPOTENCY: If already rejected, return success
    if quote["status"] == "REJECTED":
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Quote already rejected", "errorCode": "ALREADY_REJECTED"}

    # Cannot reject accepted quotes - quote lifecycle ends at ACCEPTED
    if quote["status"] == "ACCEPTED":
        raise HTTPException(
            status_code=400,
            detail={"message": "Cannot reject accepted quote", "errorCode": "INVALID_STATUS"}
        )

    # Can only reject sent quotes
    if quote["status"] != "SENT":
        raise HTTPException(
            status_code=400,
            detail={"message": "Can only reject sent quotes", "errorCode": "INVALID_STATUS"}
        )

    now = datetime.utcnow()
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"status": "REJECTED", "rejectedAt": now}}
    )

    # Send a system message about rejection
    customer = await db.users.find_one({"_id": ObjectId(current_user.id)})
    customer_name = customer.get("name", "Customer") if customer else "Customer"

    reject_message = {
        "requestId": quote["requestId"],
        "senderId": current_user.id,
        "senderName": customer_name,
        "senderRole": "customer",
        "type": "system",
        "text": f"Quote rejected. Provider can revise and resend.",
        "quoteId": quote_id,
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(reject_message)
    # Update last_message_at for unread tracking
    await db.service_requests.update_one(
        {"_id": ObjectId(quote["requestId"])},
        {"$set": {"last_message_at": now}}
    )

    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])

    return {"success": True, "quote": updated_quote}

# =============================================================================
# COUNTER QUOTE
# Extracted from counter_quote() in server.py (~line 3171).
# =============================================================================
async def counter_quote(quote_id: str, counter_data: dict, current_user, db):
    """
    Customer counters a quote with a different amount.
    IDEMPOTENT: If already countered with same amount, return success.
    Can only counter SENT quotes.
    """
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Only customer can counter
    if quote["customerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can counter quotes")

    # Validate counter amount
    counter_amount = counter_data.get("counterAmount")
    if counter_amount is None:
        raise HTTPException(status_code=400, detail="counterAmount is required")

    try:
        counter_amount = float(counter_amount)
        if counter_amount <= 0:
            raise HTTPException(status_code=400, detail="Counter amount must be greater than 0")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid counter amount")

    # Validate and trim counter note
    counter_note = counter_data.get("counterNote", "") or ""
    counter_note = counter_note.strip()[:500]

    # IDEMPOTENCY: If already countered with same amount, return success
    if quote["status"] == "COUNTERED" and quote.get("counterAmount") == counter_amount:
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Quote already countered with this amount", "errorCode": "ALREADY_COUNTERED"}

    # Cannot counter accepted quotes - quote lifecycle ends at ACCEPTED
    if quote["status"] == "ACCEPTED":
        raise HTTPException(
            status_code=400,
            detail={"message": "Cannot counter accepted quote", "errorCode": "INVALID_STATUS"}
        )

    # Can only counter sent quotes
    if quote["status"] != "SENT":
        raise HTTPException(
            status_code=400,
            detail={"message": "Can only counter sent quotes", "errorCode": "INVALID_STATUS"}
        )

    now = datetime.utcnow()
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {
            "status": "COUNTERED",
            "counterAmount": counter_amount,
            "counterNote": counter_note,
            "counteredAt": now
        }}
    )

    # Send a system message about counter offer
    customer = await db.users.find_one({"_id": ObjectId(current_user.id)})
    customer_name = customer.get("name", "Customer") if customer else "Customer"

    counter_text = f"Counter offer: ${counter_amount:.2f}"
    if counter_note:
        counter_text += f" - \"{counter_note}\""

    counter_message = {
        "requestId": quote["requestId"],
        "senderId": current_user.id,
        "senderName": customer_name,
        "senderRole": "customer",
        "type": "system",
        "text": counter_text,
        "quoteId": quote_id,
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(counter_message)
    # Update last_message_at for unread tracking
    await db.service_requests.update_one(
        {"_id": ObjectId(quote["requestId"])},
        {"$set": {"last_message_at": now}}
    )

    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])

    return {"success": True, "quote": updated_quote}

# =============================================================================
# GET QUOTE BY REQUEST
# Extracted from get_quote_by_request() in server.py (~line 3268).
# =============================================================================
async def get_quote_by_request(request_id: str, current_user, db):
    """Get the latest quote for a request."""
    # Verify user is part of this request
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")

    if not is_customer and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get the latest quote for this request
    quote = await db.quotes.find_one(
        {"requestId": request_id},
        sort=[("createdAt", -1)]
    )

    if quote:
        quote["_id"] = str(quote["_id"])

        # Include provider rating info for the customer (quote comparison)
        if is_customer and quote.get("providerId"):
            quote_provider = await db.providers.find_one({"_id": ObjectId(quote["providerId"])})
            if quote_provider:
                quote["providerName"] = quote_provider.get("name", "Provider")
                quote["providerRating"] = quote_provider.get("averageRating")
                quote["providerReviewCount"] = quote_provider.get("totalReviews", 0)

    return {"quote": quote}


# =============================================================================
# ACCEPT QUOTE
# Extracted from accept_quote() in server.py (~line 3305).
# =============================================================================
async def accept_quote(quote_id: str, current_user, db):
    """Customer accepts the quote."""
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Verify accepter is the customer
    if quote.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can accept quotes")

    if quote["status"] != "SENT":
        raise HTTPException(status_code=400, detail=f"Cannot accept quote with status {quote['status']}")

    now = datetime.utcnow()
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"status": "ACCEPTED", "acceptedAt": now}}
    )

    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])

    return {"success": True, "quote": updated_quote}

# =============================================================================
# SANDBOX PAY QUOTE
# Extracted from sandbox_pay_quote() in server.py (~line 3333).
# =============================================================================
async def sandbox_pay_quote(quote_id: str, current_user, db):
    """
    Customer completes sandbox payment. Sets quote to PAID and job to PAID/READY_TO_START.
    Valid transition: accepted -> paid
    """
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Verify payer is the customer
    if quote.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can pay quotes")

    # Quote must be ACCEPTED before payment can proceed
    if quote["status"] != "ACCEPTED":
        raise HTTPException(
            status_code=400,
            detail={"message": f"Quote must be accepted before payment. Current status: {quote['status']}", "errorCode": "INVALID_STATUS"}
        )

    # Verify job exists and is in correct state
    request = await db.service_requests.find_one({"_id": ObjectId(quote["requestId"])})
    if not request:
        raise HTTPException(status_code=404, detail="Associated job request not found")

    current_status = request.get("status")
    current_payment_status = request.get("paymentStatus", "unpaid")

    # IDEMPOTENCY: If already held in escrow, return success (do not double-process)
    if current_payment_status == "held":
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Payment already held in escrow", "errorCode": "ALREADY_PAID"}

    # Payment is only allowed when job is in awaiting_payment status
    if current_status not in ["awaiting_payment"]:
        raise HTTPException(
            status_code=400,
            detail={"message": f"Cannot pay: job must be in 'awaiting_payment' status. Current: {current_status}", "errorCode": "INVALID_STATUS"}
        )

    now = datetime.utcnow()

    # =========================================================================
    # PAYMENT BREAKDOWN ENGINE
    # Creates PaymentTransaction + ProviderPayout with idempotency
    # =========================================================================

    # Generate a unique payment transaction ID for idempotency
    payment_provider_txn_id = f"sandbox_{quote_id}_{quote['requestId']}"

    # Check for existing transaction (idempotency)
    existing_txn = await db.payment_transactions.find_one({
        "paymentProviderTxnId": payment_provider_txn_id
    })

    if not existing_txn:
        # Fee & Commission Config
        SERVICE_FEE_FLAT = 40.00  # TTD flat fee charged to customer
        COMMISSION_RATE = 0.10   # 10% commission from provider
        CURRENCY = "TTD"

        # Transaction Fee Config (payment processor fee)
        # Typical: 2.9% + fixed fee, but using simplified % for sandbox
        TRANSACTION_FEE_RATE = 0.029  # 2.9% of total transaction
        TRANSACTION_FEE_FIXED = 0.00  # Could be a fixed fee component

        job_price = float(quote["amount"])

        # Calculate breakdown
        service_fee = SERVICE_FEE_FLAT
        commission = round(job_price * COMMISSION_RATE, 2)
        total_paid_by_customer = round(job_price + service_fee, 2)
        provider_payout_amount = round(job_price - commission, 2)

        # Calculate transaction fee (on total paid by customer)
        # In production, this would come from the payment gateway response
        transaction_fee = round(total_paid_by_customer * TRANSACTION_FEE_RATE + TRANSACTION_FEE_FIXED, 2)

        # Calculate Fixr's net revenue (internal accounting)
        # FixrNet = serviceFee + commission - transactionFee
        fixr_gross = round(service_fee + commission, 2)
        fixr_net = round(fixr_gross - transaction_fee, 2)

        # VAT fields (dormant for now)
        vat_enabled = False
        vat_rate = 0.0
        vat_total = 0.0

        # Create PaymentTransaction record
        payment_txn = {
            "jobId": quote["requestId"],
            "quoteId": quote_id,
            "customerId": current_user.id,
            "providerId": quote.get("providerId"),
            "jobPrice": job_price,
            "serviceFee": service_fee,
            "commissionRate": COMMISSION_RATE,
            "commission": commission,
            "totalPaidByCustomer": total_paid_by_customer,
            "currency": CURRENCY,
            "paymentProviderTxnId": payment_provider_txn_id,
            "status": "completed",
            # Transaction fee fields (internal accounting, not displayed to customer)
            "transactionFeeRate": TRANSACTION_FEE_RATE,
            "transactionFee": transaction_fee,
            "fixrGross": fixr_gross,  # serviceFee + commission
            "fixrNet": fixr_net,      # fixrGross - transactionFee
            # VAT fields (dormant)
            "vatEnabled": vat_enabled,
            "vatRate": vat_rate,
            "vatTotal": vat_total,
            "createdAt": now,
            "updatedAt": now,
        }

        txn_result = await db.payment_transactions.insert_one(payment_txn)
        payment_txn_id = str(txn_result.inserted_id)

        # Create linked ProviderPayout record (status: pending)
        provider_payout = {
            "paymentTransactionId": payment_txn_id,
            "jobId": quote["requestId"],
            "quoteId": quote_id,
            "providerId": quote.get("providerId"),
            "amount": provider_payout_amount,
            "currency": CURRENCY,
            "status": "pending",
            "createdAt": now,
            "updatedAt": now,
        }

        await db.provider_payouts.insert_one(provider_payout)

        logger.info(f"Payment Breakdown: jobPrice={job_price}, serviceFee={service_fee}, commission={commission}, providerPayout={provider_payout_amount}, transactionFee={transaction_fee}, fixrGross={fixr_gross}, fixrNet={fixr_net}, txnId={payment_provider_txn_id}")
    else:
        logger.info(f"Payment transaction already exists for txnId={payment_provider_txn_id}, skipping (idempotent)")

    # Sync legacy fields via _sync_paid_state (job.paymentStatus, job.paidAt, quote.paidAt)
    await _sync_paid_state(quote["requestId"], "paid", quote_id, db)

    # Send a system message in chat about payment
    customer = await db.users.find_one({"_id": ObjectId(current_user.id)})
    customer_name = customer.get("name", "Customer") if customer else "Customer"

    payment_message = {
        "requestId": quote["requestId"],
        "senderId": current_user.id,
        "senderName": customer_name,
        "senderRole": "customer",
        "type": "payment",
        "text": f"Payment confirmed: ${quote['amount']:.2f} {quote['currency']} (Sandbox)",
        "quoteId": quote_id,
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(payment_message)
    # Update last_message_at for unread tracking
    await db.service_requests.update_one(
        {"_id": ObjectId(quote["requestId"])},
        {"$set": {"last_message_at": now}}
    )

    # IDEMPOTENT: Add "Fixr" system message about Job Start Code being ready (customer-only)
    existing_start_code_msg = await db.job_messages.find_one({
        "requestId": quote["requestId"],
        "senderName": "Fixr",
        "text": {"$regex": "Job Start Code is ready"},
        "targetRole": "customer"
    })

    msg_time = datetime.utcnow()
    if not existing_start_code_msg:
        start_code_message = {
            "requestId": quote["requestId"],
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "text",
            "text": "Fixr: Job Start Code is ready. Please check Details to share it with your provider.",
            "targetRole": "customer",
            "createdAt": msg_time,
            "deliveredAt": msg_time,
            "readAt": None,
        }
        await db.job_messages.insert_one(start_code_message)
        # Update last_message_at for unread tracking
        await db.service_requests.update_one(
            {"_id": ObjectId(quote["requestId"])},
            {"$set": {"last_message_at": msg_time}}
        )

    # IDEMPOTENT: Add provider-specific message about collecting Start Code on-site
    existing_provider_start_msg = await db.job_messages.find_one({
        "requestId": quote["requestId"],
        "senderName": "Fixr",
        "text": {"$regex": "Start Code is collected ON-SITE"},
        "targetRole": "provider"
    })

    if not existing_provider_start_msg:
        provider_msg_time = datetime.utcnow()
        provider_start_message = {
            "requestId": quote["requestId"],
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "text",
            "text": "Fixr: Payment secured. Start Code is collected ON-SITE. When you arrive, ask the customer to reveal the 6-digit Start Code to begin the job.",
            "targetRole": "provider",
            "createdAt": provider_msg_time,
            "deliveredAt": provider_msg_time,
            "readAt": None,
        }
        await db.job_messages.insert_one(provider_start_message)
        # Update last_message_at for unread tracking
        await db.service_requests.update_one(
            {"_id": ObjectId(quote["requestId"])},
            {"$set": {"last_message_at": provider_msg_time}}
        )

    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])

    return {"success": True, "quote": updated_quote, "message": "Payment confirmed (sandbox)"}
