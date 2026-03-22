"""
update_test_provider.py
=======================
Updates the existing Test Provider (provider003@test.com) record so it
displays polished, complete metadata in the Provider Directory card.

WHAT IT UPDATES:
  - providers collection: profilePhotoUrl, governmentIdFrontUrl,
    governmentIdBackUrl, uploadsComplete, setupComplete, verificationStatus,
    averageRating, totalReviews, completedJobsCount, baseTown,
    phoneVerified, bio
  - users collection: name (display name polished)

WHAT IT DOES NOT TOUCH:
  - No frontend / UI code changes
  - No provider directory layout changes
  - Existing userId, availabilityStatus, password, tokens preserved
  - services updated to: plumbing, electrical, cleaning, handyman (for realistic matching tests)
  - All other provider records untouched

HOW TO RUN:
    From your project root:
        python backend/update_test_provider.py

    Or from the backend directory:
        python update_test_provider.py

SAFE TO RE-RUN: Reads current state first, reports what changed.
"""

import asyncio
import os
from pathlib import Path
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

# ── Load env from backend/.env ─────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

# ── Target account ─────────────────────────────────────────────────────────
TEST_PROVIDER_EMAIL = "provider003@test.com"

# ── Stable public photo URL ────────────────────────────────────────────────
# Same source used by the demo providers — randomuser.me is stable and
# renders correctly in the app's <Image source={{ uri: ... }} /> component.
PROFILE_PHOTO_URL   = "https://randomuser.me/api/portraits/men/52.jpg"
GOVT_ID_URL         = "https://randomuser.me/api/portraits/lego/2.jpg"   # Private, never shown to customers


async def update():
    client = AsyncIOMotorClient(MONGO_URL)
    db     = client[DB_NAME]

    print(f"\n🔗  Connected to MongoDB: {DB_NAME}")
    print("=" * 60)

    # ── 1. Find the user record ─────────────────────────────────────────
    user = await db.users.find_one({"email": TEST_PROVIDER_EMAIL})
    if not user:
        print(f"❌  User not found: {TEST_PROVIDER_EMAIL}")
        print("    Make sure the backend has been started at least once so")
        print("    seed_canonical_accounts() has run.")
        client.close()
        return

    user_id = str(user["_id"])
    print(f"✅  Found user: {user.get('name')} ({TEST_PROVIDER_EMAIL})")
    print(f"    userId: {user_id}")

    # ── 2. Find the linked provider document ───────────────────────────
    provider = await db.providers.find_one({"userId": user_id})
    if not provider:
        print(f"\n⚠️  No provider document found for userId={user_id}")
        print("    This means provider003 hasn't completed provider setup yet.")
        print("    Please log in as provider003@test.com once and complete the")
        print("    provider setup flow, then re-run this script.")
        client.close()
        return

    provider_id = str(provider["_id"])
    print(f"✅  Found provider document: providerId={provider_id}")
    print(f"    Current profilePhotoUrl:    {provider.get('profilePhotoUrl')}")
    print(f"    Current verificationStatus: {provider.get('verificationStatus')}")
    print(f"    Current setupComplete:      {provider.get('setupComplete')}")
    print(f"    Current uploadsComplete:    {provider.get('uploadsComplete')}")
    print(f"    Current averageRating:      {provider.get('averageRating')}")
    print(f"    Current completedJobsCount: {provider.get('completedJobsCount')}")
    print(f"    Current baseTown:           {provider.get('baseTown')}")
    print()

    # ── 3. Build the provider update payload ───────────────────────────
    # Only sets fields that need changing — preserves everything else
    # (userId, availabilityStatus, isAcceptingJobs, password, etc.)
    provider_update = {
        # Services: Test Provider covers all 4 major categories for realistic matching tests
        "services": ["plumbing", "electrical", "cleaning", "handyman"],
        # Photo — required for the listing filter AND card display
        "profilePhotoUrl":      PROFILE_PHOTO_URL,
        "governmentIdFrontUrl": GOVT_ID_URL,
        "governmentIdBackUrl":  GOVT_ID_URL,

        # Required by GET /api/providers filter
        "setupComplete":        True,
        "uploadsComplete":      True,

        # Trust & verification
        "verificationStatus":   "verified",
        "phoneVerified":        True,

        # Stats — drive the badge display in provider cards
        "averageRating":        4.6,
        "totalReviews":         21,
        "completedJobsCount":   29,

        # Location badge
        "baseTown":             "Chaguanas",

        # Bio preview text shown on cards
        "bio": (
            "Trusted service professional available for quality "
            "home maintenance and repairs."
        ),

        "updatedAt": datetime.utcnow(),
    }

    result = await db.providers.update_one(
        {"_id": ObjectId(provider_id)},
        {"$set": provider_update}
    )

    if result.modified_count == 1:
        print(f"✅  Provider document updated ({result.modified_count} record modified)")
    else:
        print(f"⚠️  Provider update matched {result.matched_count} record(s), "
              f"modified {result.modified_count}. "
              f"(May already be up to date.)")

    # ── 4. Update the user display name if needed ───────────────────────
    # The get_provider() endpoint fetches name from the users collection.
    # Ensure it's clean — not "provider003" or similar.
    current_name = user.get("name", "")
    desired_name = "Test Provider"

    if current_name != desired_name:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": desired_name, "updatedAt": datetime.utcnow()}}
        )
        # Also keep name in sync on the provider document
        await db.providers.update_one(
            {"_id": ObjectId(provider_id)},
            {"$set": {"name": desired_name}}
        )
        print(f"✅  User name updated: '{current_name}' → '{desired_name}'")
    else:
        print(f"⏭   User name already correct: '{current_name}'")

    # ── 5. Verify the record now passes the listing filter ──────────────
    print()
    print("🔎  Verifying Test Provider passes GET /api/providers filter...")

    refreshed = await db.providers.find_one({"_id": ObjectId(provider_id)})

    passes_filter = (
        refreshed.get("setupComplete") is True
        and refreshed.get("profilePhotoUrl") is not None
        and refreshed.get("governmentIdFrontUrl") is not None
    )

    if passes_filter:
        print(f"✅  PASSES listing filter")
    else:
        print(f"❌  FAILS listing filter — check setupComplete, profilePhotoUrl, governmentIdFrontUrl")

    # ── 6. Print final state ────────────────────────────────────────────
    print()
    print("📋  Final provider state:")
    print(f"    name:                {refreshed.get('name')}")
    print(f"    profilePhotoUrl:     {refreshed.get('profilePhotoUrl')}")
    print(f"    verificationStatus:  {refreshed.get('verificationStatus')}")
    print(f"    setupComplete:       {refreshed.get('setupComplete')}")
    print(f"    uploadsComplete:     {refreshed.get('uploadsComplete')}")
    print(f"    phoneVerified:       {refreshed.get('phoneVerified')}")
    print(f"    averageRating:       {refreshed.get('averageRating')}")
    print(f"    totalReviews:        {refreshed.get('totalReviews')}")
    print(f"    completedJobsCount:  {refreshed.get('completedJobsCount')}")
    print(f"    baseTown:            {refreshed.get('baseTown')}")
    print(f"    availabilityStatus:  {refreshed.get('availabilityStatus')}")
    print(f"    services:            {refreshed.get('services')}")  # Should show all 4 for matching tests
    print(f"    bio:                 {refreshed.get('bio')[:60]}...")

    client.close()

    print()
    print("=" * 60)
    print("🎉  Update complete.")
    print()
    print("    Test Provider will now show in the Provider Directory with:")
    print("    • Profile photo (randomuser.me portrait)")
    print("    • ✅ Verified badge")
    print("    • ☎️  Phone Verified badge")
    print("    • ⭐ 4.6 rating")
    print("    • 💼 29 jobs completed")
    print("    • 📍 Chaguanas location")
    print("    • Bio preview text")
    print()
    print("    No backend restart needed — reads live from MongoDB.")
    print()


if __name__ == "__main__":
    asyncio.run(update())
