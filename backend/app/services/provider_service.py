# backend/app/services/provider_service.py
# Responsibility: Business logic for provider domain operations.
# Phase 3: Stub function signatures only.
#
# No logic, no DB calls, no imports from active modules.
# All provider business logic currently lives in server.py and remains there.
# Logic will be migrated from server.py in Phase 4+.
# This module is NOT connected to any active request flow.


async def get_provider_by_id(provider_id: str):
    """
    Retrieve a single provider profile by provider ID.
    Phase 4+: Will query db.providers and return full provider detail.
    Migrated from server.py GET /providers/{provider_id} handler.
    """
    pass


async def list_providers(filters: dict):
    """
    Retrieve a filtered list of providers for the directory.
    Phase 4+: Will query db.providers with service/location/availability filters.
    Migrated from server.py GET /providers handler.
    Must preserve existing matching logic — do not redesign.
    """
    pass


async def get_provider_profile(user_id: str):
    """
    Retrieve the provider profile for the currently authenticated user.
    Phase 4+: Will query db.providers by userId.
    Migrated from server.py GET /providers/me handler.
    """
    pass


async def update_provider_availability(user_id: str, availability_status: str):
    """
    Update the availability status of a provider.
    Phase 4+: Will update db.providers availabilityStatus field.
    Migrated from server.py PATCH /providers/me/availability handler.
    """
    pass
