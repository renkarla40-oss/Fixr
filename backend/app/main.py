import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from .database import client, db
from .routers import (
    auth,
    users,
    providers,
    service_requests,
    messages,
    activity,
    config,
    quotes,
)

# ---------------------------------------------------------------------------
# Logging — match server.py format exactly
# ---------------------------------------------------------------------------
logging.basicConfig(
      level=logging.INFO,
      format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI()

# ---------------------------------------------------------------------------
# Validation error handler — exact copy of server.py behaviour
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
      print("=== VALIDATION ERROR ===")
      print(f"Errors: {exc.errors()}")
      print(f"Request URL: {request.url}")
      print(f"Request method: {request.method}")
      try:
                body = await request.body()
                print(f"Request body: {body.decode()}")
except Exception:
        print("Could not read request body")
    print("======================")
    return JSONResponse(
              status_code=422,
              content={"detail": exc.errors()},
    )

# ---------------------------------------------------------------------------
# CORS — exact copy of server.py
# ---------------------------------------------------------------------------
app.add_middleware(
      CORSMiddleware,
      allow_credentials=True,
      allow_origins=["*"],
      allow_methods=["*"],
      allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers — all existing routers, prefix /api
# ---------------------------------------------------------------------------
app.include_router(auth.router,             prefix="/api")
app.include_router(users.router,            prefix="/api")
app.include_router(providers.router,        prefix="/api")
app.include_router(service_requests.router, prefix="/api")
app.include_router(messages.router,         prefix="/api")
app.include_router(activity.router,         prefix="/api")
app.include_router(config.router,           prefix="/api")

app.include_router(quotes.router,           prefix="/api")
 ---------------------------------------------------------------------------
# Startup — log DB connectivity; database.py already created client/db
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_db_check():
      """
          Verify MongoDB is reachable and log basic counts.
              client and db are already initialised by database.py at import time.
                  Mirrors the informational logging in server.py startup.
                      """
      logger.info("=" * 50)
      logger.info("backend/app startup")
      logger.info("=" * 50)
      try:
                total_users = await db.users.count_documents({})
                total_providers = await db.providers.count_documents({})
                logger.info(f"MongoDB connected — users: {total_users}, providers: {total_providers}")
except Exception as e:
        logger.error(f"MongoDB connectivity check failed: {e}")
    logger.info("=" * 50)

# ---------------------------------------------------------------------------
# Shutdown — close MongoDB client (matches server.py)
# ---------------------------------------------------------------------------
@app.on_event("shutdown")
async def shutdown_db_client():
      client.close()
  
