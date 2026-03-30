# backend/app/main.py
# STARTUP ISOLATION STEP 5: All blocks active.
# connect_db() + notification indexes + seed logic (safe) + background task.
# Full parity with server.py startup sequence.

import asyncio
import logging
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.database import connect_db, close_db, get_db
from app.config import FLAGS

# --- Router imports ---
from app.routes import service_requests
from app.routes import quotes
from app.routes import messages
from app.routes import payments
from app.routes import reviews
from app.routes import notifications
from app.routes import auth
from app.routes import customer
from app.routes import provider
from app.routes import otp
from app.routes import admin
from app.routes import request_events

logger = logging.getLogger(__name__)

# --- App factory ---
app = FastAPI(
    title="Fixr API",
    description="Fixr backend — modular architecture.",
    version="1.0.0",
)

# --- Validation error handler ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("=== VALIDATION ERROR ===")
    print(f"Errors: {exc.errors()}")
    print(f"Request URL: {request.url}")
    print(f"Request method: {request.method}")
    try:
        body = await request.body()
        print(f"Request body: {body}")
    except Exception:
        pass
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body) if hasattr(exc, "body") else None},
    )

# --- CORS middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router mounts ---
app.include_router(service_requests.router, prefix="/api")
app.include_router(quotes.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(provider.router)
app.include_router(otp.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(request_events.router, prefix="/api")

# --- Health check ---
@app.get("/health")
def health_check():
    return {"status": "ok", "entrypoint": "app.main", "startup": "step-5-full"}


# =============================================================================
# BLOCK D: PROVIDER TIMEOUT BACKGROUND TASK (24 hour timeout)
# Exact extraction from server.py. Uses get_db() instead of module-level db.
# =============================================================================
async def provider_timeout_checker():
    """
    Background task that periodically checks for providers who haven't responded
    within 24 hours of being assigned to a request.

    Runs every 5 minutes to check for timed-out assignments.
    """
    while True:
        try:
            await asyncio.sleep(300)  # Check every 5 minutes

            _db = get_db()

            # Find pending requests where providerAssignedAt is more than 24 hours ago
            timeout_threshold = datetime.utcnow() - timedelta(hours=24)

            timed_out_requests = await _db.service_requests.find({
                "status": "pending",
                "providerId": {"\$ne": None},
                "providerAssignedAt": {"\$lt": timeout_threshold}
            }).to_list(100)

            for request in timed_out_requests:
                request_id = str(request["_id"])
                provider_id = request.get("providerId")

                if not provider_id:
                    continue

                logger.info(f"[Timeout] Provider {provider_id} timed out on request {request_id}")

                # Release the provider and add to exclusion list
                await _db.service_requests.update_one(
                    {"_id": request["_id"]},
                    {
                        "\$set": {
                            "providerId": None,
                            "providerName": None,
                            "providerAssignedAt": None,
                            "isGeneralRequest": True,
                        },
                        "\$addToSet": {
                            "excludedProviderIds": provider_id
                        }
                    }
                )

                now = datetime.utcnow()

                # System message to customer about timeout
                customer_msg = {
                    "requestId": request_id,
                    "senderId": "system",
                    "senderName": "Fixr",
                    "senderRole": "system",
                    "type": "system",
                    "text": "The provider didn't respond in time. You can choose another provider now.",
                    "targetRole": "customer",
                    "createdAt": now,
                    "deliveredAt": now,
                    "readAt": None,
                }
                await _db.job_messages.insert_one(customer_msg)

                # Update last_message_at for unread tracking
                await _db.service_requests.update_one(
                    {"_id": request["_id"]},
                    {"\$set": {"last_message_at": now}}
                )

                logger.info(f"[Timeout] Released provider {provider_id} from request {request_id}")

        except asyncio.CancelledError:
            logger.info("[Timeout] Provider timeout checker stopped")
            break
        except Exception as e:
            logger.error(f"[Timeout] Error in provider timeout checker: {e}")
            await asyncio.sleep(60)  # Wait a minute before retrying on error


# =============================================================================
# STARTUP / SHUTDOWN
# =============================================================================
@app.on_event("startup")
async def startup():
    # BLOCK A: DB connection
    await connect_db()

    # Obtain live db reference via get_db() — NOT the module-level import
    _db = get_db()

    # BLOCK B: Notification indexes
    try:
        await _db.notifications.create_index("userId")
        await _db.notifications.create_index([("userId", 1), ("createdAt", -1)])
        await _db.notifications.create_index([("userId", 1), ("isRead", 1)])
        logger.info("\u2705 Notification indexes created/verified")
    except Exception as e:
        logger.warning(f"Could not create notification indexes: {e}")

    # BLOCK C: Seed logic — fully guarded, will never crash startup
    try:
        logger.info("=" * 50)
        logger.info("MVP TEST ACCOUNT CHECK")
        logger.info("=" * 50)

        customer003 = await _db.users.find_one({"email": "customer003@test.com"})
        provider003 = await _db.users.find_one({"email": "provider003@test.com"})

        if customer003:
            logger.info("\u2705 MVP Customer: customer003@test.com")
        else:
            logger.info("\u26a0\ufe0f  Missing: customer003@test.com - create manually if needed")

        if provider003:
            logger.info("\u2705 MVP Provider: provider003@test.com")
            try:
                prov003_doc = await _db.providers.find_one({"userId": str(provider003["_id"])})
                if prov003_doc:
                    required_services = ["plumbing", "electrical", "cleaning", "handyman"]
                    if prov003_doc.get("services") != required_services:
                        await _db.providers.update_one(
                            {"userId": str(provider003["_id"])},
                            {"\$set": {"services": required_services}}
                        )
                        logger.info(f"\u2705 Test Provider services updated to {required_services}")
                    else:
                        logger.info("\u23ed Test Provider services already correct")
            except Exception as e:
                logger.warning(f"Could not upsert Test Provider services: {e}")
        else:
            logger.info("\u26a0\ufe0f  Missing: provider003@test.com - create manually if needed")

        # Upsert Provider Test legacy document
        try:
            prov_test_doc = await _db.providers.find_one({"name": "Provider Test"})
            if prov_test_doc:
                required_pt_services = ["cleaning"]
                current_pt_services = prov_test_doc.get("services", [])
                needs_update = current_pt_services != required_pt_services
                uid_val = prov_test_doc.get("userId")
                uid_is_bad = not uid_val or not isinstance(uid_val, str)
                if needs_update or uid_is_bad:
                    patch = {"services": required_pt_services}
                    if uid_is_bad:
                        patch["userId"] = ""
                    await _db.providers.update_one(
                        {"name": "Provider Test"},
                        {"\$set": patch}
                    )
                    logger.info(f"\u2705 Provider Test patched: services={required_pt_services}, userId_fixed={uid_is_bad}")
                else:
                    logger.info(f"\u23ed Provider Test already correct: {current_pt_services}")
            else:
                logger.info("\u26a0\ufe0f  Provider Test document not found in providers collection")
        except Exception as e:
            logger.warning(f"Could not patch Provider Test: {e}")

        # Log total counts
        total_users = await _db.users.count_documents({})
        total_providers = await _db.providers.count_documents({})
        logger.info(f"\n\U0001f4ca Total users: {total_users}, providers: {total_providers}")
        logger.info("=" * 50)

        # Log feature flags
        logger.info("MVP FEATURE FLAGS:")
        logger.info(f"  MVP_MODE: {FLAGS.MVP_MODE}")
        logger.info(f"  ENABLE_LOCATION_MATCHING: {FLAGS.ENABLE_LOCATION_MATCHING}")
        logger.info(f"  ENABLE_REVIEWS: {FLAGS.ENABLE_REVIEWS}")
        logger.info(f"  ENABLE_NOTIFICATIONS: {FLAGS.ENABLE_NOTIFICATIONS}")
        logger.info(f"  TEST_MATCHING: {FLAGS.TEST_MATCHING}")
        logger.info("=" * 50)

    except Exception:
        logger.exception("Seed logic failed — startup continues regardless")

    # BLOCK D: Background task
    asyncio.create_task(provider_timeout_checker())
    logger.info("\u2705 Provider timeout checker started (24h timeout)")


@app.on_event("shutdown")
async def shutdown():
    await close_db()
