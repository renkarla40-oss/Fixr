# backend/app/database.py
# Responsibility: Database connection setup using lazy initialization.
# Phase 2: Shared foundations. server.py remains the active backend.
# This module is importable but does NOT open a connection at import time.
# A connection is only created when connect_db() is explicitly called.

import os
from motor.motor_asyncio import AsyncIOMotorClient

# =============================================================================
# LAZY-INITIALIZED GLOBALS
# Both start as None. No connection is made at import time.
# connect_db() must be called before get_db() can return a usable db object.
# =============================================================================
client: AsyncIOMotorClient = None
db = None


async def connect_db() -> None:
    """
    Initialize the MongoDB client and database reference.
    Must be called explicitly (e.g., from main.py lifespan startup).
    Does NOT run at import time.
    """
    global client, db
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]


async def close_db() -> None:
    """
    Close the MongoDB client if it was initialized.
    Should be called on application shutdown.
    """
    global client
    if client is not None:
        client.close()
        client = None


def get_db():
    """
    Return the initialized database reference.
    Raises RuntimeError if called before connect_db().
    """
    if db is None:
        raise RuntimeError(
            "Database not initialized. Call connect_db() first."
        )
    return db
