import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from ..database import db
from ..auth import get_current_user
from ..models import User

router = APIRouter()
logger = logging.getLogger(__name__)


class QuoteStatus:
    DRAFT = "DRAFT"
    SENT = "SENT"
    COUNTERED = "COUNTERED"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"
    VOID = "VOID"


QUOTE_TRANSITIONS = {
    QuoteStatus.DRAFT:    [QuoteStatus.SENT],
    QuoteStatus.SENT:     [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.COUNTERED],
    QuoteStatus.COUNTERED:[QuoteStatus.SENT],
    QuoteStatus.REJECTED: [QuoteStatus.SENT],
    QuoteStatus.ACCEPTED: [],
    QuoteStatus.VOID:     [],
}


class PaymentStatus:
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


SERVICE_FEE_FLAT = 40.00
COMMISSION_RATE = 0.10
CURRENCY = "TTD"
TRANSACTION_FEE_RATE = 0.029
TRANSACTION_FEE_FIXED = 0.00


def get_status_display_name(status: str) -> str:
    names = {
        "pending": "Pending",
        "accepted": "Accepted",
        "awaiting_payment": "Awaiting Payment",
        "in_progress": "In Progress",
        "completed_pending_review": "Pending Review",
        "completed_reviewed": "Completed",
        "completed": "Completed",
    }
    return names.get(status, status.title())


async def sync_paid_state(job_id: str, payment_status: str, quote_id: str = None):
    if payment_status != PaymentStatus.PAID:
        logger.debug(f"[sync_paid_state] Skipping for job {job_id}")
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
        await db.service_requests.update_one({"_id": ObjectId(job_id)}, {"$set": job_update})
        logger.info(f"[sync_paid_state] Synced job {job_id}: {list(job_update.keys())}")
    quote_query = {"requestId": job_id, "status": QuoteStatus.ACCEPTED}
    if quote_id:
        quote_query["_id"] = ObjectId(quote_id)
    quote = await db.quotes.find_one(quote_query)
    if quote and not quote.get("paidAt"):
        await db.quotes.update_one({"_id": quote["_id"]}, {"$set": {"paidAt": now}})
        logger.info(f"[sync_paid_state] Synced quote {quote['_id']} paidAt")


@router.post("/quotes")
async def create_quote(
    quote_data: dict,
    current_user: User = Depends(get_current_user),
):
    request_id = quote_data.get("requestId")
    if not request_id:
        raise HTTPException(status_code=400, detail="requestId is required")
    amount = quote_data.get("amount", 0)
    try:
        amount = float(amount)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid amount")
    note = quote_data.get("note", "") or ""
    note = note.strip()[:500] if note else ""
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
        "status": QuoteStatus.DRAFT,
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

@router.post("/quotes/{quote_id}/send")
async def send_quote(
    quote_id: str,
    current_user: User = Depends(get_current_user),
):
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("providerUserId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quote creator can send it")
    if quote["status"] == QuoteStatus.SENT:
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Quote already sent", "errorCode": "ALREADY_SENT"}
    if quote["status"] == QuoteStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail={"message": "Quote already accepted, cannot revise", "errorCode": "ALREADY_ACCEPTED"})
    if quote["status"] not in [QuoteStatus.DRAFT, QuoteStatus.COUNTERED, QuoteStatus.REJECTED]:
        raise HTTPException(status_code=400, detail={"message": f"Cannot send quote with status {quote['status']}", "errorCode": "INVALID_STATUS"})
    request = await db.service_requests.find_one({"_id": ObjectId(quote["requestId"])})
    if request:
        current_status = request.get("status")
        if current_status in ["in_progress", "completed"]:
            raise HTTPException(status_code=400, detail={"message": f"Cannot send quote: job is already {get_status_display_name(current_status)}", "errorCode": "INVALID_STATUS"})
    now = datetime.utcnow()
    current_revision = quote.get("revision", 1)
    if quote["status"] in [QuoteStatus.COUNTERED, QuoteStatus.REJECTED]:
        current_revision += 1
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"status": QuoteStatus.SENT, "sentAt": now, "revision": current_revision, "counterAmount": None, "counterNote": None, "counteredAt": None, "rejectedAt": None}},
    )
    await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"status": "awaiting_payment", "updatedAt": now}})
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
    await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"last_message_at": now}})
    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])
    return {"success": True, "quote": updated_quote}

@router.patch("/quotes/{quote_id}/revise")
async def revise_quote(
    quote_id: str,
    revision_data: dict,
    current_user: User = Depends(get_current_user),
):
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("providerUserId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quote creator can revise it")
    if quote["status"] not in [QuoteStatus.COUNTERED, QuoteStatus.REJECTED, QuoteStatus.DRAFT]:
        if quote["status"] == QuoteStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail={"message": "Quote already accepted, cannot revise", "errorCode": "ALREADY_ACCEPTED"})
        raise HTTPException(status_code=400, detail={"message": f"Cannot revise quote with status {quote['status']}", "errorCode": "INVALID_STATUS"})
    update_fields = {}
    if "amount" in revision_data:
        try:
            amount = float(revision_data["amount"])
            if amount <= 0:
                raise HTTPException(status_code=400, detail="Amount must be greater than 0")
            update_fields["amount"] = amount
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid amount")
    if "note" in revision_data:
        note = revision_data["note"] or ""
        update_fields["note"] = note.strip()[:500]
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_fields["updatedAt"] = datetime.utcnow()
    await db.quotes.update_one({"_id": ObjectId(quote_id)}, {"$set": update_fields})
    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])
    return {"success": True, "quote": updated_quote}


@router.post("/quotes/{quote_id}/reject")
async def reject_quote(
    quote_id: str,
    current_user: User = Depends(get_current_user),
):
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote["customerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can reject quotes")
    if quote["status"] == QuoteStatus.REJECTED:
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Quote already rejected", "errorCode": "ALREADY_REJECTED"}
    if quote["status"] == QuoteStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail={"message": "Cannot reject accepted quote", "errorCode": "INVALID_STATUS"})
    if quote["status"] != QuoteStatus.SENT:
        raise HTTPException(status_code=400, detail={"message": "Can only reject sent quotes", "errorCode": "INVALID_STATUS"})
    now = datetime.utcnow()
    await db.quotes.update_one({"_id": ObjectId(quote_id)}, {"$set": {"status": QuoteStatus.REJECTED, "rejectedAt": now}})
    customer = await db.users.find_one({"_id": ObjectId(current_user.id)})
    customer_name = customer.get("name", "Customer") if customer else "Customer"
    reject_message = {
        "requestId": quote["requestId"],
        "senderId": current_user.id,
        "senderName": customer_name,
        "senderRole": "customer",
        "type": "system",
        "text": "Quote rejected. Provider can revise and resend.",
        "quoteId": quote_id,
        "createdAt": now,
        "deliveredAt": now,
        "readAt": None,
    }
    await db.job_messages.insert_one(reject_message)
    await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"last_message_at": now}})
    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])
    return {"success": True, "quote": updated_quote}

@router.post("/quotes/{quote_id}/counter")
async def counter_quote(
    quote_id: str,
    counter_data: dict,
    current_user: User = Depends(get_current_user),
):
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote["customerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can counter quotes")
    counter_amount = counter_data.get("counterAmount")
    if counter_amount is None:
        raise HTTPException(status_code=400, detail="counterAmount is required")
    try:
        counter_amount = float(counter_amount)
        if counter_amount <= 0:
            raise HTTPException(status_code=400, detail="Counter amount must be greater than 0")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid counter amount")
    counter_note = counter_data.get("counterNote", "") or ""
    counter_note = counter_note.strip()[:500]
    if quote["status"] == QuoteStatus.COUNTERED and quote.get("counterAmount") == counter_amount:
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Quote already countered with this amount", "errorCode": "ALREADY_COUNTERED"}
    if quote["status"] == QuoteStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail={"message": "Cannot counter accepted quote", "errorCode": "INVALID_STATUS"})
    if quote["status"] != QuoteStatus.SENT:
        raise HTTPException(status_code=400, detail={"message": "Can only counter sent quotes", "errorCode": "INVALID_STATUS"})
    now = datetime.utcnow()
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"status": QuoteStatus.COUNTERED, "counterAmount": counter_amount, "counterNote": counter_note, "counteredAt": now}},
    )
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
    await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"last_message_at": now}})
    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])
    return {"success": True, "quote": updated_quote}


@router.get("/quotes/by-request/{request_id}")
async def get_quote_by_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")
    if not is_customer and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized")
    quote = await db.quotes.find_one(
        {"requestId": request_id},
        sort=[("createdAt", -1)],
    )
    if quote:
        quote["_id"] = str(quote["_id"])
        if is_customer and quote.get("providerId"):
            quote_provider = await db.providers.find_one({"_id": ObjectId(quote["providerId"])})
            if quote_provider:
                quote["providerName"] = quote_provider.get("name", "Provider")
                quote["providerRating"] = quote_provider.get("averageRating")
                quote["providerReviewCount"] = quote_provider.get("totalReviews", 0)
    return {"quote": quote}


@router.post("/quotes/{quote_id}/accept")
async def accept_quote(
    quote_id: str,
    current_user: User = Depends(get_current_user),
):
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can accept quotes")
    if quote["status"] != QuoteStatus.SENT:
        raise HTTPException(status_code=400, detail=f"Cannot accept quote with status {quote['status']}")
    now = datetime.utcnow()
    await db.quotes.update_one({"_id": ObjectId(quote_id)}, {"$set": {"status": QuoteStatus.ACCEPTED, "acceptedAt": now}})
    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])
    return {"success": True, "quote": updated_quote}

@router.post("/quotes/{quote_id}/sandbox-pay")
async def sandbox_pay_quote(
    quote_id: str,
    current_user: User = Depends(get_current_user),
):
    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.get("customerId") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the customer can pay quotes")
    if quote["status"] != QuoteStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail={"message": f"Quote must be accepted before payment. Current status: {quote['status']}", "errorCode": "INVALID_STATUS"})
    request = await db.service_requests.find_one({"_id": ObjectId(quote["requestId"])})
    if not request:
        raise HTTPException(status_code=404, detail="Associated service request not found")
    current_status = request.get("status")
    current_payment_status = request.get("paymentStatus", "unpaid")
    if current_payment_status == "held":
        quote["_id"] = str(quote["_id"])
        return {"success": True, "quote": quote, "message": "Payment already held in escrow", "errorCode": "ALREADY_PAID"}
    if current_status not in ["awaiting_payment"]:
        raise HTTPException(status_code=400, detail={"message": f"Cannot pay: job must be in 'awaiting_payment' status. Current: {current_status}", "errorCode": "INVALID_STATUS"})
    now = datetime.utcnow()
    existing_payment = await db.payments.find_one({"jobId": quote["requestId"]})
    if existing_payment:
        await db.payments.update_one(
            {"_id": existing_payment["_id"]},
            {"$set": {"status": PaymentStatus.PAID, "gateway": "sandbox", "gatewayRef": f"sandbox_{quote_id}_{quote['requestId']}", "updatedAt": now}},
        )
    else:
        job_price = float(quote["amount"])
        total_paid_by_customer = round(job_price + SERVICE_FEE_FLAT, 2)
        payment_record = {
            "jobId": quote["requestId"],
            "quoteId": quote_id,
            "customerId": current_user.id,
            "amount": job_price,
            "serviceFee": SERVICE_FEE_FLAT,
            "total": total_paid_by_customer,
            "currency": CURRENCY,
            "status": PaymentStatus.PAID,
            "gateway": "sandbox",
            "gatewayRef": f"sandbox_{quote_id}_{quote['requestId']}",
            "createdAt": now,
            "updatedAt": now,
        }
        await db.payments.insert_one(payment_record)
    await sync_paid_state(quote["requestId"], PaymentStatus.PAID, quote_id)
    payment_provider_txn_id = f"sandbox_{quote_id}_{quote['requestId']}"
    existing_txn = await db.payment_transactions.find_one({"paymentProviderTxnId": payment_provider_txn_id})
    if not existing_txn:
        job_price = float(quote["amount"])
        service_fee = SERVICE_FEE_FLAT
        commission = round(job_price * COMMISSION_RATE, 2)
        total_paid_by_customer = round(job_price + service_fee, 2)
        provider_payout_amount = round(job_price - commission, 2)
        transaction_fee = round(total_paid_by_customer * TRANSACTION_FEE_RATE + TRANSACTION_FEE_FIXED, 2)
        fixr_gross = round(service_fee + commission, 2)
        fixr_net = round(fixr_gross - transaction_fee, 2)
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
            "transactionFeeRate": TRANSACTION_FEE_RATE,
            "transactionFee": transaction_fee,
            "fixrGross": fixr_gross,
            "fixrNet": fixr_net,
            "vatEnabled": False,
            "vatRate": 0.0,
            "vatTotal": 0.0,
            "createdAt": now,
            "updatedAt": now,
        }
        txn_result = await db.payment_transactions.insert_one(payment_txn)
        payment_txn_id = str(txn_result.inserted_id)
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
        logger.info(f"Payment Breakdown: jobPrice={job_price}, serviceFee={service_fee}, commission={commission}, providerPayout={provider_payout_amount}, txnId={payment_provider_txn_id}")
    else:
        logger.info(f"Payment transaction already exists for txnId={payment_provider_txn_id}, skipping (idempotent)")
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
    await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"last_message_at": now}})
    existing_start_code_msg = await db.job_messages.find_one({"requestId": quote["requestId"], "senderName": "Fixr", "text": {"$regex": "Job Start Code is ready"}, "targetRole": "customer"})
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
        await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"last_message_at": msg_time}})
    existing_provider_start_msg = await db.job_messages.find_one({"requestId": quote["requestId"], "senderName": "Fixr", "text": {"$regex": "Start Code is collected ON-SITE"}, "targetRole": "provider"})
    if not existing_provider_start_msg:
        provider_msg_time = datetime.utcnow()
        provider_start_message = {
            "requestId": quote["requestId"],
            "senderId": "system",
            "senderName": "Fixr",
            "senderRole": "system",
            "type": "text",
            "text": "Fixr: Payment secured. Start Code is collected ON-SITE.",
            "targetRole": "provider",
            "createdAt": provider_msg_time,
            "deliveredAt": provider_msg_time,
            "readAt": None,
        }
        await db.job_messages.insert_one(provider_start_message)
        await db.service_requests.update_one({"_id": ObjectId(quote["requestId"])}, {"$set": {"last_message_at": provider_msg_time}})
    updated_quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    updated_quote["_id"] = str(updated_quote["_id"])
    return {"success": True, "quote": updated_quote, "message": "Payment confirmed (sandbox)"}
