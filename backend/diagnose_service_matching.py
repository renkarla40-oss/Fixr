"""
diagnose_service_matching.py
=============================
Inspects the provider service matching pipeline to explain why
"No Providers available" appears after a customer submits a request.

Checks:
  1. Every provider document — prints their services[] array values exactly
     as stored in MongoDB (case, spaces, format)
  2. Simulates GET /api/providers?service=X for common serviceKeys and shows
     which providers match or are rejected, and why
  3. Identifies any provider visible in the directory but invisible in search

USAGE:
    python backend/diagnose_service_matching.py

No changes are made. Read-only.
"""

import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

# These are the serviceKey values the frontend sends (from serviceCategories.ts)
FRONTEND_SERVICE_KEYS = [
    "plumbing", "electrical", "ac_hvac", "cleaning", "handyman",
    "painting", "carpentry", "roofing", "flooring", "masonry",
    "renovation", "landscaping", "fencing", "pools", "appliance_repair",
    "pest_control", "windows_doors", "welding", "moving", "other",
]


async def run() -> None:
    client = AsyncIOMotorClient(MONGO_URL)
    db     = client[DB_NAME]

    print("\nFixr provider service matching diagnostic")
    print("=" * 66)

    # ── Listing filter (same as GET /api/providers without service param) ──
    listing_filter = {
        "setupComplete": True,
        "profilePhotoUrl":      {"$ne": None, "$exists": True},
        "governmentIdFrontUrl": {"$ne": None, "$exists": True},
    }

    all_visible = await db.providers.find(listing_filter).to_list(None)
    all_providers = await db.providers.find({}).to_list(None)

    print(f"\nTotal provider documents in DB : {len(all_providers)}")
    print(f"Visible in directory (pass listing filter): {len(all_visible)}")

    # ── 1. Print every provider's stored services[] values ─────────────────
    print("\n" + "─" * 66)
    print("STEP 1 — Exact services[] values stored per provider")
    print("─" * 66)

    for p in all_providers:
        pid     = str(p.get("_id", "?"))
        name    = p.get("name", "?")
        svcs    = p.get("services", [])
        setup   = p.get("setupComplete", False)
        photo   = bool(p.get("profilePhotoUrl"))
        govt_id = bool(p.get("governmentIdFrontUrl"))
        passes  = setup and photo and govt_id

        print(f"\n  Provider: {name} ({pid})")
        print(f"    setupComplete      : {setup}")
        print(f"    profilePhotoUrl    : {'✓ set' if photo else '✗ MISSING — invisible in directory'}")
        print(f"    governmentIdFrontUrl: {'✓ set' if govt_id else '✗ MISSING — invisible in directory'}")
        print(f"    Passes listing filter: {'✅ YES' if passes else '❌ NO — will not appear in directory'}")
        if svcs:
            print(f"    services[]         : {svcs}")
            for s in svcs:
                stripped = s.strip()
                if stripped != s:
                    print(f"      ⚠  '{s}' has leading/trailing whitespace!")
                if stripped.lower() != stripped:
                    print(f"      ⚠  '{s}' is not lowercase — frontend sends lowercase serviceKeys")
        else:
            print(f"    services[]         : [] ← EMPTY — will never match any service filter!")

    # ── 2. Simulate the service matching query ──────────────────────────────
    print("\n" + "─" * 66)
    print("STEP 2 — Simulating GET /api/providers?service=X for each serviceKey")
    print("─" * 66)

    matched_any = False
    for key in FRONTEND_SERVICE_KEYS:
        query = {**listing_filter, "services": key}
        matches = await db.providers.find(query).to_list(None)
        if matches:
            matched_any = True
            names = [m.get("name", "?") for m in matches]
            print(f"\n  service={key!r:25s} → {len(matches)} match(es): {names}")
        # Only print non-matches for keys that providers claim to offer
        else:
            # Check if any provider has this key in any case variant
            variants = await db.providers.find({
                "services": {"$regex": f"^{key}$", "$options": "i"}
            }).to_list(None)
            if variants:
                names = [v.get("name", "?") for v in variants]
                print(f"\n  service={key!r:25s} → 0 matches ← CASE MISMATCH!")
                print(f"    Providers have this value but in wrong case: {names}")
                stored_vals = [v.get("services", []) for v in variants]
                print(f"    Their stored services: {stored_vals}")

    if not matched_any:
        print("\n  ❌ NO serviceKey produced any matches — all providers have")
        print("     mismatched or empty services[] arrays.")

    # ── 3. Identify all unique services values stored in DB ─────────────────
    print("\n" + "─" * 66)
    print("STEP 3 — All unique values stored in services[] across all providers")
    print("─" * 66)

    all_svc_values = set()
    for p in all_providers:
        for s in p.get("services", []):
            all_svc_values.add(s)

    if all_svc_values:
        for val in sorted(all_svc_values):
            in_keys = val.strip().lower() in FRONTEND_SERVICE_KEYS
            status  = "✅ matches a frontend serviceKey" if in_keys else "❌ NOT a known frontend serviceKey"
            print(f"  {val!r:35s} → {status}")
    else:
        print("  No services values found at all.")

    # ── 4. Summary and recommendation ───────────────────────────────────────
    print("\n" + "═" * 66)
    print("SUMMARY")
    print("═" * 66)

    all_stored = sorted(all_svc_values)
    bad_values = [v for v in all_stored if v.strip().lower() not in FRONTEND_SERVICE_KEYS or v != v.strip().lower()]

    if not bad_values:
        print("\n✅ All stored services[] values match frontend serviceKeys exactly.")
        print("   The matching pipeline looks correct. Check whether providers")
        print("   actually exist and pass the listing filter (setupComplete,")
        print("   profilePhotoUrl, governmentIdFrontUrl all set).")
    else:
        print(f"\n❌ Found {len(bad_values)} service value(s) that will NEVER match:")
        for v in bad_values:
            suggested = v.strip().lower()
            print(f"   Stored: {v!r}  →  should be: {suggested!r}")
        print("\n   RUN FIX: python backend/fix_service_values.py")
        print("   This will normalise all stored values to lowercase serviceKeys.")

    client.close()
    print()


if __name__ == "__main__":
    asyncio.run(run())
