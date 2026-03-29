# backend/app/main.py
# Responsibility: FastAPI application factory and router registration.
# Phase 10: Active production entrypoint. All migrated routers mounted under /api.
# Render start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
# server.py retained on disk for rollback. Do not delete until stable.

import asyncio
import logging
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.database import connect_db, close_db, db
from app.config import FLAGS

# --- Router imports ---
# Active migrated routers (mounted under /api)
from app.routes import service_requests
from app.routes import quotes
from app.routes import messages
from app.routes import payments
from app.routes import reviews
from app.routes import notifications

# Stub routers with own /api prefix (mounted without extra prefix)
from app.routes import auth
from app.routes import customer
from app.routes import provider

# Stub routers mounted under /api
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
# --- Validation error handler (exact copy from server.py) ---
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

# --- CORS middleware (exact from server.py) ---
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router mounts ---
# Active migrated routers: mounted under /api
# Each router already has its own sub-prefix (e.g. /service-requests, /quotes)
# Result: /api/service-requests/..., /api/quotes/..., etc.
app.include_router(service_requests.router, prefix="/api")
app.include_router(quotes.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")

# Stub routers with own /api prefix — mounted without extra prefix
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(provider.router)

# Stub routers without own /api prefix — mounted under /api
app.include_router(otp.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(request_events.router, prefix="/api")
# --- Health check ---
@app.get("/health")
def health_check():
    return {"status": "ok", "entrypoint": "app.main"}


# --- Provider timeout background task (exact copy from server.py) ---
async def provider_timeout_checker():
    """
    Background task that periodically checks for providers who have not responded
    within 24 hours of being assigned to a request.
    Runs every 5 minutes.
    """
    while True:
        try:
            await asyncio.sleep(300)  # Check every 5 minutes
            timeout_threshold = datetime.utcnow() - timedelta(hours=24)
            timed_out_requests = await db.service_requests.find({
                "status": "pending",
                "providerId": {"$ne": None},
                "providerAssignedAt": {"$lt": timeout_threshold}
            }).to_list(100)
            for request in timed_out_requests:
                request_id = str(request["_id"])
                provider_id = request.get("providerId")
                logger.info(f"[Timeout] Provider {provider_id} timed out on request {request_id}")
                await db.service_requests.update_one(
                    {"_id": request["_id"]},
                    {
                        "$set": {
                            "status": "pending",
                            "providerId": None,
                            "providerAssignedAt": None,
                            "isGeneralRequest": True,
                        },
                        "$addToSet": {
                            "excludedProviderIds": provider_id
                        }
                    }
                )
                now = datetime.utcnow()
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
                await db.job_messages.insert_one(customer_msg)
                await db.service_requests.update_one(
                    {"_id": request["_id"]},
                    {"$set": {"last_message_at": now}}
                )
                logger.info(f"[Timeout] Released provider {provider_id} from request {request_id}")
        except asyncio.CancelledError:
            logger.info("[Timeout] Provider timeout checker stopped")
            break
        except Exception as e:
            logger.error(f"[Timeout] Error in provider timeout checker: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def seed_canonical_accounts():
    """
    Connect to DB, seed canonical test accounts on startup (MVP MODE),
    create notification indexes, start provider timeout checker.
    Exact logic from server.py.
    """
    await connect_db()

    logger.info("=" * 50)
    logger.info("MVP TEST ACCOUNT CHECK")
    logger.info("=" * 50)

    customer003 = await db.users.find_one({"email": "customer003@test.com"})
    provider003 = await db.users.find_one({"email": "provider003@test.com"})

    if customer003:
        logger.info(f"\u2705 MVP Customer: customer003@test.com")
    else:
        logger.info(f"\u26a0\ufe0f  Missing: customer003@test.com - create manually if needed")

    if provider003:
        logger.info(f"\u2705 MVP Provider: provider003@test.com")
        try:
            prov_test_doc = await db.providers.find_one({"name": "Provider Test"})
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
                    await db.providers.update_one(
                        {"name": "Provider Test"},
                        {"$set": patch}
                    )
                    logger.info("\u2705 Provider Test services/userId patched")
        except Exception as e:
            logger.warning(f"Could not patch Provider Test: {e}")
    else:
        logger.info(f"\u26a0\ufe0f  Missing: provider003@test.com - create manually if needed")

    total_users = await db.users.count_documents({})
    total_providers = await db.providers.count_documents({})
    logger.info(f"\n\U0001f4ca Total users: {total_users}, providers: {total_providers}")
    logger.info("=" * 50)

    logger.info("MVP FEATURE FLAGS:")
    logger.info(f"  MVP_MODE: {FLAGS.MVP_MODE}")
    logger.info(f"  ENABLE_LOCATION_MATCHING: {FLAGS.ENABLE_LOCATION_MATCHING}")
    logger.info(f"  ENABLE_REVIEWS: {FLAGS.ENABLE_REVIEWS}")
    logger.info(f"  ENABLE_NOTIFICATIONS: {FLAGS.ENABLE_NOTIFICATIONS}")
    logger.info(f"  TEST_MATCHING: {FLAGS.TEST_MATCHING}")
    logger.info("=" * 50)

    try:
        await db.notifications.create_index("userId")
        await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
        await db.notifications.create_index([("userId", 1), ("isRead", 1)])
        logger.info("\u2705 Notification indexes created/verified")
    except Exception as e:
        logger.warning(f"Could not create notification indexes: {e}")

    asyncio.create_task(provider_timeout_checker())
    logger.info("\u2705 Provider timeout checker started (24h timeout)")


@app.on_event("shutdown")
async def shutdown_db_client():
    await close_db()
