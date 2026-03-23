"""
seed_demo_providers.py
======================
Inserts 4 demo provider accounts into the Fixr MongoDB database.

HOW TO RUN:
    From your project root (where backend/ lives):
        cd /path/to/Fixr
        python backend/seed_demo_providers.py

    Or from the backend directory:
        cd /path/to/Fixr/backend
        python seed_demo_providers.py

SAFE TO RE-RUN:
    Checks by email before inserting — will not create duplicate users.
    If a provider already exists, updates their services to match the
    required seed setup (upsert-services).

WHAT IT DOES:
    1. Inserts a user record for each provider (needed because get_provider()
       fetches name/phone from the users collection via userId).
    2. Inserts the provider document linked to that user via userId.
    3. Sets all required fields so providers pass the GET /api/providers filter:
       setupComplete=True, profilePhotoUrl != None, governmentIdFrontUrl != None
    4. Sets verificationStatus="verified" so the Verified badge shows in the app.
    5. On re-run: updates services for existing providers to keep seed data correct.
"""
import asyncio
import os
from pathlib import Path
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# ── Load env from backend/.env ────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Stable public placeholder photos ──────────────────────────────────────
# These are real stable image URLs used as stand-ins.
# The app will display them correctly because profilePhotoUrl is served
# via the frontend's <Image source={{ uri: ... }} /> component which
# accepts any full http/https URL.
PLACEHOLDER_MALE_1   = "https://randomuser.me/api/portraits/men/32.jpg"
PLACEHOLDER_FEMALE_1 = "https://randomuser.me/api/portraits/women/44.jpg"
PLACEHOLDER_MALE_2   = "https://randomuser.me/api/portraits/men/67.jpg"
PLACEHOLDER_FEMALE_2 = "https://randomuser.me/api/portraits/women/58.jpg"

# Government ID placeholder — private, never shown to customers
PLACEHOLDER_GOVT_ID = "https://randomuser.me/api/portraits/lego/1.jpg"

# ── Provider definitions ───────────────────────────────────────────────────
# Each entry has a `user` dict and a `provider` dict.
# `provider.userId` is filled in at runtime after the user is inserted.
#
# SERVICE DISTRIBUTION (for realistic matching tests):
#   Colin Baptiste  → Electrical
#   Brianna Ali     → Cleaning
#   Devon Thomas    → Handyman
#   Provider Test   → Cleaning   (overlaps Brianna; Plumbing covered by Test Provider)
DEMO_PROVIDERS = [
    {
        "user": {
            "email": "colin.baptiste@fixr-demo.tt",
            "name": "Colin Baptiste",
            "phone": "1-868-621-0001",
            "currentRole": "provider",
            "isProviderEnabled": True,
            "isBetaUser": True,
            "password": pwd_context.hash("Fixr2024!"),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        },
        "provider": {
            # userId injected below
            "name": "Colin Baptiste",
            "phone": "1-868-621-0001",
            "services": ["electrical"],
            "bio": "Skilled electrician handling residential wiring, lighting, and breaker repairs.",
            "verificationStatus": "verified",
            "setupComplete": True,
            "baseTown": "San Fernando",
            "travelDistanceKm": 25,
            "travelAnywhere": False,
            "availabilityStatus": "available",
            "isAcceptingJobs": True,
            "availabilityNote": None,
            "profilePhotoUrl": PLACEHOLDER_MALE_1,
            "governmentIdFrontUrl": PLACEHOLDER_GOVT_ID,
            "governmentIdBackUrl": PLACEHOLDER_GOVT_ID,
            "uploadsComplete": True,
            "phoneVerified": True,
            "phoneVerifiedAt": datetime.utcnow(),
            "completedJobsCount": 87,
            "averageRating": 4.8,
            "totalReviews": 62,
            "riskFlags": [],
            "createdAt": datetime.utcnow(),
        },
    },
    {
        "user": {
            "email": "brianna.ali@fixr-demo.tt",
            "name": "Brianna Ali",
            "phone": "1-868-622-0002",
            "currentRole": "provider",
            "isProviderEnabled": True,
            "isBetaUser": True,
            "password": pwd_context.hash("Fixr2024!"),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        },
        "provider": {
            "name": "Brianna Ali",
            "phone": "1-868-622-0002",
            "services": ["cleaning"],
            "bio": "Professional cleaner offering home, deep-clean, and office cleaning services.",
            "verificationStatus": "verified",
            "setupComplete": True,
            "baseTown": "Chaguanas",
            "travelDistanceKm": 30,
            "travelAnywhere": False,
            "availabilityStatus": "on_another_job",  # New status — amber badge
            "isAcceptingJobs": False,
            "availabilityNote": None,
            "profilePhotoUrl": PLACEHOLDER_FEMALE_1,
            "governmentIdFrontUrl": PLACEHOLDER_GOVT_ID,
            "governmentIdBackUrl": PLACEHOLDER_GOVT_ID,
            "uploadsComplete": True,
            "phoneVerified": True,
            "phoneVerifiedAt": datetime.utcnow(),
            "completedJobsCount": 112,
            "averageRating": 4.7,
            "totalReviews": 89,
            "riskFlags": [],
            "createdAt": datetime.utcnow(),
        },
    },
    {
        "user": {
            "email": "devon.thomas@fixr-demo.tt",
            "name": "Devon Thomas",
            "phone": "1-868-623-0003",
            "currentRole": "provider",
            "isProviderEnabled": True,
            "isBetaUser": True,
            "password": pwd_context.hash("Fixr2024!"),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        },
        "provider": {
            "name": "Devon Thomas",
            "phone": "1-868-623-0003",
            "services": ["handyman"],
            "bio": "Versatile handyman for small home fixes, maintenance, and general improvement work.",
            "verificationStatus": "verified",
            "setupComplete": True,
            "baseTown": "Port of Spain",
            "travelDistanceKm": 20,
            "travelAnywhere": False,
            "availabilityStatus": "fully_booked",  # New status — muted red badge
            "isAcceptingJobs": False,
            "availabilityNote": None,
            "profilePhotoUrl": PLACEHOLDER_MALE_2,
            "governmentIdFrontUrl": PLACEHOLDER_GOVT_ID,
            "governmentIdBackUrl": PLACEHOLDER_GOVT_ID,
            "uploadsComplete": True,
            "phoneVerified": True,
            "phoneVerifiedAt": datetime.utcnow(),
            "completedJobsCount": 64,
            "averageRating": 4.9,
            "totalReviews": 51,
            "riskFlags": [],
            "createdAt": datetime.utcnow(),
        },
    },
    {
        "user": {
            "email": "provider.test@fixr-demo.tt",
            "name": "Provider Test",
            "phone": "1-868-624-0004",
            "currentRole": "provider",
            "isProviderEnabled": True,
            "isBetaUser": True,
            "password": pwd_context.hash("Fixr2024!"),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        },
        "provider": {
            # userId injected below
            "name": "Provider Test",
            "phone": "1-868-624-0004",
            "services": ["cleaning"],
            "bio": "Reliable cleaning professional offering home, deep-clean, and office cleaning services.",
            "verificationStatus": "verified",
            "setupComplete": True,
            "baseTown": "Arima",
            "travelDistanceKm": 35,
            "travelAnywhere": False,
            "availabilityStatus": "available",
            "isAcceptingJobs": True,
            "availabilityNote": None,
            "profilePhotoUrl": PLACEHOLDER_FEMALE_2,
            "governmentIdFrontUrl": PLACEHOLDER_GOVT_ID,
            "governmentIdBackUrl": PLACEHOLDER_GOVT_ID,
            "uploadsComplete": True,
            "phoneVerified": True,
            "phoneVerifiedAt": datetime.utcnow(),
            "completedJobsCount": 43,
            "averageRating": 4.5,
            "totalReviews": 34,
            "riskFlags": [],
            "createdAt": datetime.utcnow(),
        },
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"\n🔗 Connected to MongoDB: {DB_NAME}")
    print("=" * 55)

    inserted_users = 0
    inserted_providers = 0
    updated_providers = 0
    skipped = 0

    for entry in DEMO_PROVIDERS:
        user_data = entry["user"]
        provider_data = entry["provider"].copy()
        email = user_data["email"]
        name = user_data["name"]

        # ── Check if user already exists ──
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            user_id = str(existing_user["_id"])
            print(f"⏭ User already exists: {name} ({email}) — skipping user insert")
            skipped += 1
        else:
            result = await db.users.insert_one(user_data)
            user_id = str(result.inserted_id)
            inserted_users += 1
            print(f"✅ Inserted user: {name} ({email}) → userId={user_id}")

        # ── Check if provider already exists for this userId ──
        existing_provider = await db.providers.find_one({"userId": user_id})
        if existing_provider:
            # Update services to keep seed data current (safe upsert)
            await db.providers.update_one(
                {"userId": user_id},
                {"$set": {"services": provider_data["services"], "updatedAt": datetime.utcnow()}}
            )
            updated_providers += 1
            print(f"🔄 Provider exists for {name} — services updated to {provider_data['services']}")
        else:
            provider_data["userId"] = user_id
            result = await db.providers.insert_one(provider_data)
            provider_id = str(result.inserted_id)
            inserted_providers += 1
            print(f"✅ Inserted provider: {name} → providerId={provider_id}")
            print(f"   services={provider_data['services']}")
            print(f"   baseTown={provider_data['baseTown']}")
            print(f"   availabilityStatus={provider_data['availabilityStatus']}")
            print(f"   completedJobsCount={provider_data['completedJobsCount']}")
            print(f"   averageRating={provider_data['averageRating']}")
        print()

    print("=" * 55)
    print(f"✅ Done.")
    print(f"   Users inserted:     {inserted_users}")
    print(f"   Providers inserted: {inserted_providers}")
    print(f"   Providers updated:  {updated_providers}")
    print(f"   Already existed:    {skipped}")
    print()

    # ── Verify they pass the listing filter ──
    print("🔎 Verifying providers pass GET /api/providers filter...")
    visible = await db.providers.find({
        "setupComplete": True,
        "profilePhotoUrl": {"$ne": None, "$exists": True},
        "governmentIdFrontUrl": {"$ne": None, "$exists": True},
    }).to_list(100)

    demo_emails = {e["user"]["email"] for e in DEMO_PROVIDERS}
    demo_user_ids = []
    for email in demo_emails:
        u = await db.users.find_one({"email": email})
        if u:
            demo_user_ids.append(str(u["_id"]))

    demo_visible = [p for p in visible if p.get("userId") in demo_user_ids]
    print(f"   Total providers visible in listing: {len(visible)}")
    print(f"   Demo providers visible: {len(demo_visible)}")
    for p in demo_visible:
        status = p.get("availabilityStatus", "available")
        print(f"   ✅ {p['name']} — {p['services']} — {status}")

    client.close()
    print("\n🎉 Seed complete. Restart your backend if it is already running.")
    print("   Providers will appear immediately in the provider directory.\n")


if __name__ == "__main__":
    asyncio.run(seed())
