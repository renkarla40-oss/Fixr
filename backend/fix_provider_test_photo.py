"""
fix_provider_test_photo.py
===========================
Fixes the 404 profile photo for the legacy "Provider Test" provider card
(MongoDB _id: 699c27c340268000a0c4a4ae).

The provider's profilePhotoUrl points to a local uploads path that no longer
exists on disk, causing the backend to return 404 on every card render.

This script:
  1. Finds the provider document by name "Provider Test" with the known _id
  2. Confirms the broken URL
  3. Replaces it with a stable public image URL that renders in React Native

USAGE:
    python backend/fix_provider_test_photo.py
"""

import asyncio
import os
from pathlib import Path
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

# The legacy "Provider Test" provider document ID confirmed from the diagnostic
PROVIDER_TEST_ID = "699c27c340268000a0c4a4ae"

# Stable public photo — same randomuser.me style used by the other seeded providers
# This is a different portrait from the ones already used by Colin, Brianna, Devon
REPLACEMENT_PHOTO_URL = "https://randomuser.me/api/portraits/men/41.jpg"


async def run() -> None:
    client = AsyncIOMotorClient(MONGO_URL)
    db     = client[DB_NAME]

    print("\nFixr — Provider Test photo fix")
    print("=" * 55)

    # Find by _id
    try:
        provider = await db.providers.find_one({"_id": ObjectId(PROVIDER_TEST_ID)})
    except Exception as e:
        print(f"\n✗  Invalid ObjectId: {e}")
        print("   Check PROVIDER_TEST_ID at the top of this script.")
        client.close()
        return

    if not provider:
        # Fallback: search by name in case the _id is different in this DB instance
        print(f"  _id {PROVIDER_TEST_ID} not found — searching by name...")
        provider = await db.providers.find_one({"name": "Provider Test"})

    if not provider:
        print("\n✗  No provider named 'Provider Test' found in this database.")
        print("   The record may have already been cleaned up.")
        client.close()
        return

    pid              = str(provider["_id"])
    name             = provider.get("name", "?")
    current_photo    = provider.get("profilePhotoUrl", "")
    services         = provider.get("services", [])

    print(f"\n  Found   : {name}")
    print(f"  ID      : {pid}")
    print(f"  Services: {services}")
    print(f"\n  Current profilePhotoUrl:")
    print(f"    {current_photo!r}")

    # Check if the URL is a local uploads path (the broken kind)
    is_local_path = (
        current_photo.startswith("/api/uploads/") or
        current_photo.startswith("/uploads/")
    )
    is_already_remote = current_photo.startswith("http")

    if is_already_remote:
        print(f"\n  ℹ  URL is already a remote URL — may not be broken.")
        print(f"     If you're still seeing 404s, the remote URL itself may be dead.")
        print(f"     Replacing anyway with stable URL...")

    if not current_photo:
        print(f"\n  ℹ  profilePhotoUrl is empty — setting a photo.")

    print(f"\n  Replacement profilePhotoUrl:")
    print(f"    {REPLACEMENT_PHOTO_URL!r}")

    # Apply the update
    result = await db.providers.update_one(
        {"_id": provider["_id"]},
        {"$set": {
            "profilePhotoUrl": REPLACEMENT_PHOTO_URL,
            "updatedAt": datetime.utcnow(),
        }}
    )

    if result.modified_count == 1:
        print(f"\n✅  Updated successfully.")
        print(f"    The 'Provider Test' card will now show a profile photo.")
        print(f"    No backend restart needed — photo URLs are served on-demand.")
    else:
        print(f"\n⚠  Update ran but modified_count=0.")
        print(f"   The document may already have this URL, or the _id didn't match.")

    # Verify
    updated = await db.providers.find_one({"_id": provider["_id"]})
    print(f"\n  Verified stored value:")
    print(f"    {updated.get('profilePhotoUrl')!r}")

    client.close()
    print()


if __name__ == "__main__":
    asyncio.run(run())
