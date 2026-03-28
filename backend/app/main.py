# backend/app/main.py
# Responsibility: FastAPI application factory and router registration.
# Phase 1: Structural shell only. Stub routers registered — no logic migrated.
#
# IMPORTANT: This file is NOT the active production entrypoint.
# server.py remains the active backend and the uvicorn entrypoint.
# The Render start command and uvicorn configuration are NOT changed.
# This file will become the production entrypoint only in a future phase,
# after explicit approval. Do NOT modify the Render start command or
# uvicorn configuration to point here until that phase is approved.

from fastapi import FastAPI

# --- Router imports (stubs only — no logic yet) ---
from app.routes import auth
from app.routes import customer
from app.routes import provider
from app.routes import service_requests
from app.routes import quotes
from app.routes import messages
from app.routes import request_events
from app.routes import payments
from app.routes import otp
from app.routes import reviews
from app.routes import notifications
from app.routes import admin

# --- App factory ---
app = FastAPI(
    title="Fixr API",
    description="Fixr backend — modular architecture shell (Phase 1).",
    version="0.1.0",
)

# --- Register routers (stubs only) ---
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(provider.router)
app.include_router(service_requests.router)
app.include_router(quotes.router)
app.include_router(messages.router)
app.include_router(request_events.router)
app.include_router(payments.router)
app.include_router(otp.router)
app.include_router(reviews.router)
app.include_router(notifications.router)
app.include_router(admin.router)


# --- Health check (structural verification only) ---
@app.get("/health")
def health_check():
    """Confirms this structural shell can be imported without error."""
    return {"status": "ok", "note": "Phase 1 shell — server.py is the active backend"}
