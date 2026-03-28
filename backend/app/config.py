# backend/app/config.py
# Responsibility: Application-wide configuration and environment variable loading.
# Phase 2: Shared foundations. Extracted from server.py — server.py remains the active backend.
# This module is importable but not yet connected to any active request flow.

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Resolve root directory the same way server.py does
ROOT_DIR = Path(__file__).parent.parent  # backend/
load_dotenv(ROOT_DIR / ".env")

# =============================================================================
# FEATURE FLAGS
# Exact copy from server.py FeatureFlags class.
# Values are read from environment variables with safe defaults.
# =============================================================================
class FeatureFlags:
    MVP_MODE: bool = os.getenv("MVP_MODE", "true").lower() == "true"
    ENABLE_LOCATION_MATCHING: bool = os.getenv("ENABLE_LOCATION_MATCHING", "false").lower() == "true"
    ENABLE_REVIEWS: bool = os.getenv("ENABLE_REVIEWS", "false").lower() == "true"
    ENABLE_NOTIFICATIONS: bool = os.getenv("ENABLE_NOTIFICATIONS", "false").lower() == "true"
    # TEST MODE: Bypass matching filters to guarantee provider match for any service
    TEST_MATCHING: bool = os.getenv("FIXR_TEST_MATCHING", "false").lower() in ("1", "true")

# Singleton instance — matches FLAGS usage in server.py
FLAGS = FeatureFlags()

# =============================================================================
# JWT / AUTH CONSTANTS
# Exact values from server.py.
# =============================================================================
SECRET_KEY: str = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS: int = 30

# =============================================================================
# LOGGING
# Same format as server.py.
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
