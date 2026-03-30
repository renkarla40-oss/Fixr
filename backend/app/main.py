# backend/app/main.py
# STARTUP ISOLATION STEP 3: connect_db() + notification indexes.
# Seed logic and background task still commented out.
# Goal: confirm index creation does not crash startup.

import logging
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.database import connect_db, close_db, db

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
    return {"status": "ok", "entrypoint": "app.main", "startup": "isolated-step-3-indexes"}

# --- BLOCK A: DB connect/disconnect (ACTIVE) ---
# --- BLOCK B: Notification indexes (ACTIVE) ---
@app.on_event("startup")
async def startup():
    await connect_db()
    try:
        await db.notifications.create_index("userId")
        await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
        await db.notifications.create_index([("userId", 1), ("isRead", 1)])
    except Exception as e:
        logger.warning(f"Could not create notification indexes: {e}")

@app.on_event("shutdown")
async def shutdown():
    await close_db()

# BLOCK C: Seed logic — still commented out
# BLOCK D: Background task — still commented out
