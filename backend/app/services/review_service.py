# backend/app/services/review_service.py
# Responsibility: All review business logic.
# Phase 9: create_review, get_review_by_job, get_reviews_by_provider,
#          submit_job_review, skip_review migrated from server.py.
# Two distinct rating update algorithms preserved exactly (no normalization).

from bson import ObjectId
from datetime import datetime
from fastapi import HTTPException
from app.services import request_event_service


async def create_review(review_data, current_user, db, notify_fn=None):
    """
    Create a review for a completed job.
    Server-side enforcement:
    - Rating must be 1-5
    - Comment trimmed, max 500 chars
    - Job must be status=completed
    - customerId derived from auth (not client)
    - providerId derived from job (not client)
    - Idempotent: returns existing if same customer, 403 otherwise
    """
    # Server-side validation: rating 1-5
    if not (1 <= review_data.rating <= 5):
        raise HTTPException(
            status_code=400,
            detail={"message": "Rating must be between 1 and 5", "errorCode": "INVALID_RATING"}
        )

    # Server-side validation: trim and limit comment
    comment = None
    if review_data.comment:
        comment = review_data.comment.strip()[:500]
        if not comment:
            comment = None

    # Fetch job and validate
    try:
        job = await db.service_requests.find_one({"_id": ObjectId(review_data.jobId)})
    except Exception:
        raise HTTPException(status_code=400, detail={"message": "Invalid job ID", "errorCode": "INVALID_JOB_ID"})

    if not job:
        raise HTTPException(status_code=404, detail={"message": "Job not found", "errorCode": "JOB_NOT_FOUND"})

    # Authorization: only job customer can submit
    if job.get("customerId") != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"message": "Only the job's customer can review this job", "errorCode": "UNAUTHORIZED"}
        )

    # Derive providerId from job (not from client)
    provider_id = job.get("providerId")
    if not provider_id:
        raise HTTPException(
            status_code=400,
            detail={"message": "Job has no assigned provider", "errorCode": "NO_PROVIDER"}
        )

    # Idempotency check with authorization
    existing_review = await db.reviews.find_one({"jobId": review_data.jobId})
    if existing_review:
        # Only return existing review if requester is the job's customer
        if existing_review.get("customerId") != current_user.id:
            raise HTTPException(
                status_code=403,
                detail={"message": "Not authorized to access this review", "errorCode": "UNAUTHORIZED"}
            )
        existing_review["_id"] = str(existing_review["_id"])
        from app.schemas.review import Review
        return Review(**existing_review)

    # Create the review with server-derived values
    review_doc = {
        "jobId": review_data.jobId,
        "customerId": current_user.id,
        "providerId": provider_id,
        "rating": review_data.rating,
        "comment": comment,  # Trimmed and limited
        "createdAt": datetime.utcnow(),
    }

    result = await db.reviews.insert_one(review_doc)
    review_doc["_id"] = str(result.inserted_id)
    # Update provider's rating using DB aggregation (scalable)
    if provider_id:
        pipeline = [
            {"$match": {"providerId": provider_id}},
            {"$group": {
                "_id": None,
                "averageRating": {"$avg": "$rating"},
                "totalReviews": {"$sum": 1}
            }}
        ]
        agg_result = await db.reviews.aggregate(pipeline).to_list(1)

        if agg_result:
            stats = agg_result[0]
            await db.providers.update_one(
                {"_id": ObjectId(provider_id)},
                {"$set": {
                    "averageRating": round(stats["averageRating"], 2),
                    "totalReviews": stats["totalReviews"]
                }}
            )

    # Update the job record with review info
    await db.service_requests.update_one(
        {"_id": ObjectId(review_data.jobId)},
        {"$set": {
            "customerRating": review_data.rating,
            "customerReview": comment,
            "reviewedAt": datetime.utcnow()
        }}
    )

    # Send notification to provider about new review
    if provider_id and notify_fn:
        provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
        if provider and provider.get("userId"):
            stars = "\u2b50" * review_data.rating
            review_preview = f"{stars}" + (f' "{comment[:50]}..."' if comment and len(comment) > 50 else f' "{comment}"' if comment else '')
            await notify_fn(
                provider.get("userId"),
                "New Review Received",
                f"{current_user.name} left you a {review_data.rating}-star review",
                {
                    "type": "review_received",
                    "requestId": review_data.jobId,
                    "customerId": current_user.id,
                    "preview": review_preview,
                }
            )

    from app.schemas.review import Review
    return Review(**review_doc)

async def get_review_by_job(job_id: str, current_user, db):
    """
    Get the review for a specific job.
    Authorization: Only job's customer or provider can access.
    """
    try:
        job = await db.service_requests.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Authorization: only customer or provider of this job
    is_customer = job.get("customerId") == current_user.id
    is_provider = job.get("providerUserId") == current_user.id

    if not is_customer and not is_provider:
        raise HTTPException(
            status_code=403,
            detail={"message": "Only the job's customer or provider can view this review", "errorCode": "UNAUTHORIZED"}
        )

    review = await db.reviews.find_one({"jobId": job_id})
    if not review:
        raise HTTPException(status_code=404, detail="No review found for this job")

    review["_id"] = str(review["_id"])
    return review


async def get_reviews_by_provider(provider_id: str, current_user, db, limit=20):
    """
    Get reviews for a provider.
    Public-safe fields for anyone; full details only for the provider.
    """
    # Check if requester is the provider
    provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
    is_own_profile = provider and provider.get("userId") == current_user.id

    reviews = await db.reviews.find({"providerId": provider_id}).sort("createdAt", -1).to_list(limit)

    # Build response with appropriate fields
    safe_reviews = []
    for review in reviews:
        if is_own_profile:
            # Provider sees full review
            review["_id"] = str(review["_id"])
            safe_reviews.append(review)
        else:
            # Public sees only safe fields (no customerId)
            safe_reviews.append({
                "_id": str(review["_id"]),
                "rating": review["rating"],
                "comment": review.get("comment"),
                "createdAt": review.get("createdAt"),
            })

    # Also return summary stats
    total = await db.reviews.count_documents({"providerId": provider_id})

    return {
        "reviews": safe_reviews,
        "total": total,
        "limit": limit
    }

async def submit_job_review(review_data, request_id: str, current_user, db, notify_fn=None):
    """
    Customer submits a review for a completed job.
    Transitions job from completed_pending_review -> completed_reviewed.
    Rating update uses service_requests collection (distinct from create_review).
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify the current user is the customer
    if request["customerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to review this job")

    # Only allow reviews for completed jobs (both new and legacy states)
    allowed_states = ["completed_pending_review", "completed", "completed_reviewed"]
    if request["status"] not in allowed_states:
        raise HTTPException(status_code=400, detail="Reviews can only be submitted for completed jobs")

    # Check if already reviewed
    if request.get("customerRating") is not None:
        return {"success": True, "message": "You have already submitted a review for this job", "alreadyReviewed": True}

    # Validate rating
    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    # Limit review text
    review_text = (review_data.review or "")[:500]

    # Save review and transition to completed_reviewed
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "customerRating": review_data.rating,
            "customerReview": review_text,
            "reviewedAt": datetime.utcnow(),
            "status": "completed_reviewed"  # TRANSITION: Close the job and chat
        }}
    )

    # Add system message for CUSTOMER indicating chat is now closed
    customer_chat_closed_msg = {
        "requestId": request_id,
        "senderId": "system",
        "senderName": "System",
        "senderRole": "system",
        "type": "system",
        "text": "\U0001f4dd Review submitted. Chat is now closed. Thank you for your feedback!",
        "targetRole": "customer",
        "createdAt": datetime.utcnow(),
        "deliveredAt": datetime.utcnow(),
        "readAt": None,
    }
    await request_event_service.log_event(db, request_id, "review_submitted_chat_closed_customer", "system", customer_chat_closed_msg)

    # Add system message for PROVIDER about the review
    provider_review_msg = {
        "requestId": request_id,
        "senderId": "system",
        "senderName": "System",
        "senderRole": "system",
        "type": "system",
        "text": "The customer has submitted a review. You can view it in the Job Details.",
        "targetRole": "provider",
        "createdAt": datetime.utcnow(),
        "deliveredAt": datetime.utcnow(),
        "readAt": None,
    }
    await request_event_service.log_event(db, request_id, "review_submitted_notify_provider", "system", provider_review_msg)

    # Update last_message_at for unread tracking
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"last_message_at": datetime.utcnow()}}
    )
    # Update provider's average rating
    if request.get("providerId"):
        # Calculate new average
        all_reviews = await db.service_requests.find({
            "providerId": request["providerId"],
            "customerRating": {"$exists": True, "$ne": None}
        }).to_list(1000)

        if all_reviews:
            total_rating = sum(r["customerRating"] for r in all_reviews)
            # Include the new rating
            total_rating += review_data.rating
            avg_rating = total_rating / (len(all_reviews) + 1)

            await db.providers.update_one(
                {"_id": ObjectId(request["providerId"])},
                {"$set": {
                    "averageRating": round(avg_rating, 1),
                    "totalReviews": len(all_reviews) + 1
                }}
            )

    # Send notification to provider about the review
    if request.get("providerId") and notify_fn:
        provider = await db.providers.find_one({"_id": ObjectId(request["providerId"])})
        if provider:
            await notify_fn(
                user_id=provider["userId"],
                title="New Review Received",
                body=f"You received a {review_data.rating}-star review for your {request['service']} job.",
                data={
                    "type": "review_received",
                    "requestId": str(request["_id"]),
                }
            )

    return {"success": True, "message": "Thank you for your feedback", "status": "completed_reviewed"}

async def skip_review(request_id: str, current_user, db):
    """
    Customer skips review for a completed job.
    Transitions job from completed_pending_review -> completed_reviewed.
    Does NOT send push notification (exact match to server.py).
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify the current user is the customer
    if request["customerId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Only allow skip for completed_pending_review state
    if request["status"] not in ["completed_pending_review", "completed"]:
        return {"success": True, "message": "Job is not pending review", "status": request["status"]}

    # Already reviewed or skipped
    if request["status"] == "completed_reviewed":
        return {"success": True, "message": "Review already completed or skipped", "status": "completed_reviewed"}

    # Transition to completed_reviewed (skipped)
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "completed_reviewed",
            "reviewSkipped": True,
            "reviewSkippedAt": datetime.utcnow()
        }}
    )

    # Add system message indicating review was skipped and chat is closed
    chat_closed_msg = {
        "requestId": request_id,
        "senderId": "system",
        "senderName": "System",
        "senderRole": "system",
        "type": "system",
        "text": "Chat is now closed. Job complete.",
        "createdAt": datetime.utcnow(),
        "deliveredAt": datetime.utcnow(),
        "readAt": None,
    }
    await request_event_service.log_event(db, request_id, "review_skipped_chat_closed", "system", chat_closed_msg)
    # Update last_message_at for unread tracking
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"last_message_at": datetime.utcnow()}}
    )

    return {"success": True, "message": "Review skipped", "status": "completed_reviewed"}
