import os
from fastapi import APIRouter

router = APIRouter()


class FeatureFlags:
      MVP_MODE: bool = os.getenv("MVP_MODE", "true").lower() == "true"
      ENABLE_LOCATION_MATCHING: bool = os.getenv("ENABLE_LOCATION_MATCHING", "false").lower() == "true"
      ENABLE_REVIEWS: bool = os.getenv("ENABLE_REVIEWS", "false").lower() == "true"
      ENABLE_NOTIFICATIONS: bool = os.getenv("ENABLE_NOTIFICATIONS", "false").lower() == "true"
      TEST_MATCHING: bool = os.getenv("FIXR_TEST_MATCHING", "false").lower() in ("1", "true")


FLAGS = FeatureFlags()


@router.get("/config/feature-flags")
async def get_feature_flags():
      return {
                "MVP_MODE": FLAGS.MVP_MODE,
                "ENABLE_LOCATION_MATCHING": FLAGS.ENABLE_LOCATION_MATCHING,
                "ENABLE_REVIEWS": FLAGS.ENABLE_REVIEWS,
                "ENABLE_NOTIFICATIONS": FLAGS.ENABLE_NOTIFICATIONS,
      }
