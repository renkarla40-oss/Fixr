from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Add validation error handler
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

# Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: str
    currentRole: str = Field(default="customer")

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str = Field(alias="_id")
    isProviderEnabled: bool = False
    isBetaUser: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class UserInDB(User):
    password: str

class Token(BaseModel):
    token: str
    user: User

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SocialAuthRequest(BaseModel):
    provider: str  # "apple" or "google"
    providerId: str  # Apple ID or Google ID
    email: Optional[str] = None
    name: Optional[str] = None

class RoleUpdate(BaseModel):
    currentRole: str

class ProfileUpdate(BaseModel):
    name: str
    phone: str

class ProviderProfile(BaseModel):
    services: List[str] = []
    bio: str = ""
    verificationStatus: str = "pending"
    setupComplete: bool = False
    baseTown: Optional[str] = None
    travelRadiusMiles: int = 10
    travelAnywhere: bool = False

class ProviderSetup(BaseModel):
    services: List[str]
    bio: str
    baseTown: str  # Required for setup
    travelRadiusMiles: int = 10
    travelAnywhere: bool = False

class ServiceRequest(BaseModel):
    service: str
    description: str
    preferredDateTime: Optional[datetime] = None
    subCategory: Optional[str] = None  # For handyman sub-categories
    location: Optional[str] = None  # Customer's service location (legacy)
    jobTown: Optional[str] = None  # New: specific job town
    searchRadiusMiles: int = 10  # New: customer's search radius
    jobDuration: Optional[str] = None  # New: estimated job duration

class ServiceRequestResponse(BaseModel):
    id: str = Field(alias="_id")
    customerId: str
    providerId: Optional[str] = None  # Can be None for general requests
    service: str
    description: str
    preferredDateTime: Optional[datetime] = None
    status: str = "pending"
    customerName: str
    customerPhone: str
    providerName: Optional[str] = None  # Can be None for general requests
    isGeneralRequest: bool = False  # Flag for "Other Services" requests
    subCategory: Optional[str] = None  # For handyman sub-categories
    location: Optional[str] = None  # Customer's service location (legacy)
    jobTown: Optional[str] = None  # New: specific job town
    searchRadiusMiles: int = 10  # New: customer's search radius
    jobDuration: Optional[str] = None  # New: estimated job duration
    createdAt: datetime
    
    class Config:
        populate_by_name = True

class Provider(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    name: str
    phone: str
    services: List[str]
    bio: str
    verificationStatus: str
    setupComplete: bool
    baseTown: Optional[str] = None
    travelRadiusMiles: int = 10
    travelAnywhere: bool = False
    # Availability fields (Phase 3A)
    isAcceptingJobs: bool = True
    availabilityNote: Optional[str] = None  # e.g., "Weekends only", "After 5pm"
    # Response-only fields for frontend badges
    distanceFromJob: Optional[int] = None  # Distance in miles (set by endpoint)
    isOutsideSelectedArea: bool = False    # True if only shown due to travel-anywhere
    
    class Config:
        populate_by_name = True

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["_id"] = str(user["_id"])
    return User(**user)

def user_to_dict(user: dict) -> dict:
    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    return user_copy

# Auth Routes
@api_router.post("/auth/signup", response_model=Token)
async def signup(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.model_dump()
    user_dict["password"] = hashed_password
    user_dict["isProviderEnabled"] = False
    user_dict["createdAt"] = datetime.utcnow()
    user_dict["updatedAt"] = datetime.utcnow()
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    # Create token
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    
    return Token(token=access_token, user=User(**user_dict))

@api_router.post("/auth/login", response_model=Token)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user["_id"] = str(user["_id"])
    access_token = create_access_token(data={"sub": user["_id"]})
    
    return Token(token=access_token, user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/social", response_model=Token)
async def social_auth(auth_data: SocialAuthRequest):
    """
    Handle Apple and Google social authentication.
    - If user exists (by providerId or email) → log them in
    - If new user → create account and log them in
    """
    try:
        logger.info(f"Social auth request: provider={auth_data.provider}, email={auth_data.email}")
        
        # First, try to find user by provider ID
        user = await db.users.find_one({
            "authProvider": auth_data.provider,
            "providerId": auth_data.providerId
        })
        
        # If not found by provider ID, try to find by email (if email provided)
        if not user and auth_data.email:
            user = await db.users.find_one({"email": auth_data.email})
            
            # If found by email, update with provider info
            if user:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "authProvider": auth_data.provider,
                        "providerId": auth_data.providerId,
                        "updatedAt": datetime.utcnow()
                    }}
                )
                user = await db.users.find_one({"_id": user["_id"]})
        
        if user:
            # Existing user - log them in
            user["_id"] = str(user["_id"])
            access_token = create_access_token(data={"sub": user["_id"]})
            return Token(token=access_token, user=User(**user))
        
        # New user - create account
        # Generate a placeholder email if not provided (for Apple privacy)
        email = auth_data.email or f"{auth_data.providerId}@{auth_data.provider}.placeholder"
        name = auth_data.name or f"{auth_data.provider.capitalize()} User"
        
        user_dict = {
            "email": email,
            "name": name,
            "phone": "",
            "currentRole": "customer",
            "isProviderEnabled": False,
            "isBetaUser": True,  # Social auth users get beta access
            "authProvider": auth_data.provider,
            "providerId": auth_data.providerId,
            "password": "",  # No password for social auth users
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        
        access_token = create_access_token(data={"sub": str(result.inserted_id)})
        
        logger.info(f"Created new user via {auth_data.provider}: {email}")
        return Token(token=access_token, user=User(**user_dict))
        
    except Exception as e:
        logger.error(f"Social auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

# User Routes
@api_router.patch("/users/role", response_model=User)
async def switch_role(role_data: RoleUpdate, current_user: User = Depends(get_current_user)):
    if role_data.currentRole not in ["customer", "provider"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # If switching to provider, check if setup is complete
    if role_data.currentRole == "provider" and not current_user.isProviderEnabled:
        raise HTTPException(status_code=400, detail="Provider setup not complete")
    
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"currentRole": role_data.currentRole, "updatedAt": datetime.utcnow()}}
    )
    
    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)

@api_router.patch("/users/profile")
async def update_user_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    # Update user document
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {
            "name": profile_update.name,
            "phone": profile_update.phone,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    # Also update provider document if it exists
    await db.providers.update_one(
        {"userId": current_user.id},
        {"$set": {
            "name": profile_update.name,
            "phone": profile_update.phone
        }}
    )
    
    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    updated_user["_id"] = str(updated_user["_id"])
    
    return updated_user

@api_router.post("/users/provider-setup", response_model=User)
async def setup_provider(setup_data: ProviderSetup, current_user: User = Depends(get_current_user)):
    # Create or update provider profile with location data
    provider_profile = {
        "userId": current_user.id,
        "services": setup_data.services,
        "bio": setup_data.bio,
        "baseTown": setup_data.baseTown,
        "travelRadiusMiles": setup_data.travelRadiusMiles,
        "travelAnywhere": setup_data.travelAnywhere,
        "verificationStatus": "pending",
        "setupComplete": True,
        "name": current_user.name,
        "phone": current_user.phone,
        "createdAt": datetime.utcnow(),
    }
    
    existing_provider = await db.providers.find_one({"userId": current_user.id})
    if existing_provider:
        await db.providers.update_one(
            {"userId": current_user.id},
            {"$set": provider_profile}
        )
    else:
        await db.providers.insert_one(provider_profile)
    
    # Update user to enable provider access
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"isProviderEnabled": True, "currentRole": "provider", "updatedAt": datetime.utcnow()}}
    )
    
    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)

# Trinidad Towns List v1 - Comprehensive list of major towns/areas
# Each town has a canonical key and display label for future expansion
TRINIDAD_TOWNS = {
    # North-West (Port of Spain Area)
    "port_of_spain": {"label": "Port of Spain", "region": "north"},
    "woodbrook": {"label": "Woodbrook", "region": "north"},
    "st_james": {"label": "St. James", "region": "north"},
    "maraval": {"label": "Maraval", "region": "north"},
    "st_anns": {"label": "St. Ann's", "region": "north"},
    "diego_martin": {"label": "Diego Martin", "region": "north"},
    "petit_valley": {"label": "Petit Valley", "region": "north"},
    "carenage": {"label": "Carenage", "region": "north"},
    "chaguaramas": {"label": "Chaguaramas", "region": "north"},
    
    # East-West Corridor
    "san_juan": {"label": "San Juan", "region": "corridor"},
    "aranguez": {"label": "Aranguez", "region": "corridor"},
    "el_socorro": {"label": "El Socorro", "region": "corridor"},
    "tunapuna": {"label": "Tunapuna", "region": "corridor"},
    "tacarigua": {"label": "Tacarigua", "region": "corridor"},
    "arouca": {"label": "Arouca", "region": "corridor"},
    "trincity": {"label": "Trincity", "region": "corridor"},
    "maloney": {"label": "Maloney", "region": "corridor"},
    "arima": {"label": "Arima", "region": "corridor"},
    
    # Central Trinidad
    "chaguanas": {"label": "Chaguanas", "region": "central"},
    "charlieville": {"label": "Charlieville", "region": "central"},
    "longdenville": {"label": "Longdenville", "region": "central"},
    "felicity": {"label": "Felicity", "region": "central"},
    "cunupia": {"label": "Cunupia", "region": "central"},
    "freeport": {"label": "Freeport", "region": "central"},
    "couva": {"label": "Couva", "region": "central"},
    "california": {"label": "California", "region": "central"},
    "claxton_bay": {"label": "Claxton Bay", "region": "central"},
    "point_lisas": {"label": "Point Lisas", "region": "central"},
    
    # South Trinidad
    "san_fernando": {"label": "San Fernando", "region": "south"},
    "marabella": {"label": "Marabella", "region": "south"},
    "la_romaine": {"label": "La Romaine", "region": "south"},
    "palmiste": {"label": "Palmiste", "region": "south"},
    "gulf_view": {"label": "Gulf View", "region": "south"},
    "princes_town": {"label": "Princes Town", "region": "south"},
    "penal": {"label": "Penal", "region": "south"},
    "debe": {"label": "Debe", "region": "south"},
    "siparia": {"label": "Siparia", "region": "south"},
    "point_fortin": {"label": "Point Fortin", "region": "south"},
    
    # East Trinidad
    "sangre_grande": {"label": "Sangre Grande", "region": "east"},
    "valencia": {"label": "Valencia", "region": "east"},
    
    # Remote/Extra Areas
    "toco": {"label": "Toco", "region": "remote"},
    "mayaro": {"label": "Mayaro", "region": "remote"},
    "rio_claro": {"label": "Rio Claro", "region": "remote"},
    "cedros": {"label": "Cedros", "region": "remote"},
}

# Distance matrix between towns (in miles, approximate driving distances)
# Uses canonical keys for easy lookup
TOWN_DISTANCES = {
    # Port of Spain connections
    ("port_of_spain", "woodbrook"): 1,
    ("port_of_spain", "st_james"): 2,
    ("port_of_spain", "maraval"): 3,
    ("port_of_spain", "st_anns"): 3,
    ("port_of_spain", "diego_martin"): 5,
    ("port_of_spain", "san_juan"): 5,
    ("port_of_spain", "petit_valley"): 6,
    ("port_of_spain", "aranguez"): 6,
    ("port_of_spain", "carenage"): 8,
    ("port_of_spain", "el_socorro"): 8,
    ("port_of_spain", "tunapuna"): 10,
    ("port_of_spain", "chaguaramas"): 12,
    ("port_of_spain", "tacarigua"): 12,
    ("port_of_spain", "arouca"): 14,
    ("port_of_spain", "trincity"): 15,
    ("port_of_spain", "maloney"): 18,
    ("port_of_spain", "arima"): 20,
    ("port_of_spain", "chaguanas"): 25,
    ("port_of_spain", "san_fernando"): 45,
    
    # Diego Martin connections
    ("diego_martin", "petit_valley"): 2,
    ("diego_martin", "st_james"): 4,
    ("diego_martin", "woodbrook"): 5,
    ("diego_martin", "maraval"): 5,
    ("diego_martin", "carenage"): 5,
    ("diego_martin", "chaguaramas"): 10,
    
    # San Juan / East-West Corridor
    ("san_juan", "aranguez"): 2,
    ("san_juan", "el_socorro"): 3,
    ("san_juan", "tunapuna"): 6,
    ("san_juan", "tacarigua"): 8,
    ("san_juan", "arouca"): 10,
    ("san_juan", "trincity"): 12,
    ("san_juan", "maloney"): 15,
    ("san_juan", "arima"): 18,
    
    # Tunapuna area
    ("tunapuna", "tacarigua"): 2,
    ("tunapuna", "arouca"): 4,
    ("tunapuna", "trincity"): 5,
    ("tunapuna", "el_socorro"): 4,
    ("tunapuna", "aranguez"): 5,
    ("tunapuna", "maloney"): 8,
    ("tunapuna", "arima"): 10,
    
    # Arima area
    ("arima", "maloney"): 3,
    ("arima", "trincity"): 5,
    ("arima", "arouca"): 6,
    ("arima", "tacarigua"): 8,
    ("arima", "valencia"): 12,
    ("arima", "sangre_grande"): 20,
    
    # Chaguanas / Central area
    ("chaguanas", "charlieville"): 2,
    ("chaguanas", "longdenville"): 3,
    ("chaguanas", "felicity"): 3,
    ("chaguanas", "cunupia"): 4,
    ("chaguanas", "freeport"): 5,
    ("chaguanas", "couva"): 8,
    ("chaguanas", "california"): 10,
    ("chaguanas", "claxton_bay"): 12,
    ("chaguanas", "point_lisas"): 12,
    ("chaguanas", "arima"): 18,
    ("chaguanas", "san_fernando"): 20,
    
    # Couva area
    ("couva", "california"): 3,
    ("couva", "freeport"): 4,
    ("couva", "claxton_bay"): 5,
    ("couva", "point_lisas"): 6,
    ("couva", "chaguanas"): 8,
    ("couva", "san_fernando"): 15,
    
    # San Fernando / South
    ("san_fernando", "marabella"): 2,
    ("san_fernando", "la_romaine"): 3,
    ("san_fernando", "palmiste"): 4,
    ("san_fernando", "gulf_view"): 5,
    ("san_fernando", "debe"): 8,
    ("san_fernando", "penal"): 10,
    ("san_fernando", "princes_town"): 12,
    ("san_fernando", "siparia"): 15,
    ("san_fernando", "point_fortin"): 18,
    ("san_fernando", "couva"): 15,
    ("san_fernando", "claxton_bay"): 12,
    
    # Princes Town area
    ("princes_town", "penal"): 5,
    ("princes_town", "debe"): 6,
    ("princes_town", "rio_claro"): 10,
    ("princes_town", "mayaro"): 20,
    
    # Point Fortin area
    ("point_fortin", "siparia"): 8,
    ("point_fortin", "penal"): 12,
    ("point_fortin", "cedros"): 15,
    
    # Sangre Grande / East
    ("sangre_grande", "valencia"): 8,
    ("sangre_grande", "arima"): 20,
    ("sangre_grande", "toco"): 25,
    ("sangre_grande", "mayaro"): 25,
    
    # Remote areas
    ("mayaro", "rio_claro"): 15,
    ("toco", "valencia"): 18,
}

def get_town_key(town_label: str) -> Optional[str]:
    """Convert a town display label to its canonical key"""
    if not town_label:
        return None
    town_lower = town_label.lower().strip()
    # First check if it's already a key
    if town_lower.replace(" ", "_").replace(".", "").replace("'", "") in TRINIDAD_TOWNS:
        return town_lower.replace(" ", "_").replace(".", "").replace("'", "")
    # Then check labels
    for key, data in TRINIDAD_TOWNS.items():
        if data["label"].lower() == town_lower:
            return key
    return None

def get_town_label(town_key: str) -> str:
    """Convert a canonical key to display label"""
    if town_key in TRINIDAD_TOWNS:
        return TRINIDAD_TOWNS[town_key]["label"]
    return town_key  # Return as-is if not found

def get_distance_between_towns(town1: str, town2: str) -> Optional[int]:
    """Get distance between two towns in miles. Returns None if not adjacent/known."""
    key1 = get_town_key(town1)
    key2 = get_town_key(town2)
    
    if not key1 or not key2:
        return None
    
    if key1 == key2:
        return 0
    
    # Check both orderings
    if (key1, key2) in TOWN_DISTANCES:
        return TOWN_DISTANCES[(key1, key2)]
    if (key2, key1) in TOWN_DISTANCES:
        return TOWN_DISTANCES[(key2, key1)]
    
    # If no direct connection, estimate via regions or return a large value
    # For simplicity in beta, return None for unknown connections
    return None

def estimate_distance(town1: str, town2: str) -> int:
    """Estimate distance between towns, using direct distance or region-based estimate"""
    direct = get_distance_between_towns(town1, town2)
    if direct is not None:
        return direct
    
    key1 = get_town_key(town1)
    key2 = get_town_key(town2)
    
    if not key1 or not key2:
        return 999  # Unknown towns, return high value
    
    if key1 == key2:
        return 0
    
    # Region-based estimates
    region1 = TRINIDAD_TOWNS.get(key1, {}).get("region", "unknown")
    region2 = TRINIDAD_TOWNS.get(key2, {}).get("region", "unknown")
    
    if region1 == region2:
        return 10  # Same region, estimate 10 miles
    
    # Cross-region estimates
    region_distances = {
        ("north", "corridor"): 12,
        ("north", "central"): 25,
        ("north", "south"): 45,
        ("north", "east"): 35,
        ("north", "remote"): 50,
        ("corridor", "central"): 15,
        ("corridor", "south"): 35,
        ("corridor", "east"): 20,
        ("corridor", "remote"): 40,
        ("central", "south"): 20,
        ("central", "east"): 25,
        ("central", "remote"): 35,
        ("south", "east"): 40,
        ("south", "remote"): 25,
        ("east", "remote"): 25,
    }
    
    pair = tuple(sorted([region1, region2]))
    return region_distances.get(pair, 50)  # Default 50 miles for unknown

# Provider Routes
@api_router.get("/providers", response_model=List[Provider])
async def get_providers(
    service: Optional[str] = None,
    job_town: Optional[str] = None,
    search_radius: int = 10,
    include_travel_anywhere: bool = False,
    current_user: User = Depends(get_current_user)
):
    """
    Get providers with location-based matching.
    
    Matching Logic (Phase 2):
    - Bucket A (local/within radius): Providers where distance <= customer's search_radius
      AND (provider.travelAnywhere OR distance <= provider.travelRadiusMiles)
      Sorted by distance ascending (closest first)
    
    - Bucket B (travel-anywhere): Providers with travelAnywhere=true that weren't in Bucket A
      Only included if include_travel_anywhere=true
    """
    query = {"setupComplete": True}
    if service:
        query["services"] = service
    
    providers = await db.providers.find(query).to_list(100)
    
    bucket_a = []  # Local providers within radius
    bucket_b = []  # Travel-anywhere providers (outside radius)
    
    for provider in providers:
        provider["_id"] = str(provider["_id"])
        
        # Ensure new fields have defaults for backward compatibility
        if "baseTown" not in provider:
            provider["baseTown"] = None
        if "travelRadiusMiles" not in provider:
            provider["travelRadiusMiles"] = 10
        if "travelAnywhere" not in provider:
            provider["travelAnywhere"] = False
        
        # If no job_town specified, return all providers (no location filtering)
        if not job_town:
            provider["distanceFromJob"] = None
            provider["isOutsideSelectedArea"] = False
            bucket_a.append({"provider": Provider(**provider), "distance": 0})
            continue
        
        provider_base_town = provider.get("baseTown")
        provider_travel_radius = provider.get("travelRadiusMiles", 10)
        provider_travel_anywhere = provider.get("travelAnywhere", False)
        
        # Calculate distance from job town to provider's base town
        if not provider_base_town:
            # Provider hasn't set base town - skip for location-based search
            if provider_travel_anywhere and include_travel_anywhere:
                provider["distanceFromJob"] = None
                provider["isOutsideSelectedArea"] = True
                bucket_b.append(Provider(**provider))
            continue
        
        distance = estimate_distance(job_town, provider_base_town)
        
        # Bucket A Logic: Include if within customer's search radius AND
        # (provider willing to travel anywhere OR within provider's travel radius)
        is_within_customer_radius = distance <= search_radius
        is_within_provider_radius = provider_travel_anywhere or distance <= provider_travel_radius
        
        if is_within_customer_radius and is_within_provider_radius:
            # Add to Bucket A
            provider["distanceFromJob"] = distance
            provider["isOutsideSelectedArea"] = False
            bucket_a.append({"provider": Provider(**provider), "distance": distance})
        elif provider_travel_anywhere and include_travel_anywhere:
            # Bucket B: Travel-anywhere provider not in Bucket A
            provider["distanceFromJob"] = distance
            provider["isOutsideSelectedArea"] = True
            bucket_b.append(Provider(**provider))
    
    # Sort Bucket A by distance ascending (closest first)
    bucket_a.sort(key=lambda x: x["distance"])
    
    # Build result: Bucket A first, then Bucket B
    result = [item["provider"] for item in bucket_a]
    result.extend(bucket_b)
    
    return result

# Endpoint to get list of available towns for frontend dropdowns
@api_router.get("/towns")
async def get_towns():
    """Get list of all available towns for selection dropdowns"""
    towns = []
    for key, data in TRINIDAD_TOWNS.items():
        towns.append({
            "key": key,
            "label": data["label"],
            "region": data["region"]
        })
    # Sort by label for display
    towns.sort(key=lambda x: x["label"])
    return towns

@api_router.get("/providers/{provider_id}", response_model=Provider)
async def get_provider(provider_id: str, current_user: User = Depends(get_current_user)):
    provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    provider["_id"] = str(provider["_id"])
    return Provider(**provider)

# Service Request Routes
@api_router.post("/service-requests", response_model=ServiceRequestResponse)
async def create_service_request(
    request_data: ServiceRequest,
    provider_id: Optional[str] = Query(None),  # Made optional for general requests
    current_user: User = Depends(get_current_user)
):
    try:
        logger.info(f"Creating service request: {request_data.model_dump()}")
        logger.info(f"Provider ID: {provider_id}")
        
        # Check if this is a general request (Other Services Beta)
        is_general_request = provider_id is None or provider_id == "general"
        
        if is_general_request:
            # General request - no specific provider
            request_dict = {
                "customerId": current_user.id,
                "providerId": None,
                "service": request_data.service,
                "description": request_data.description,
                "preferredDateTime": request_data.preferredDateTime,
                "status": "pending",
                "customerName": current_user.name,
                "customerPhone": current_user.phone,
                "providerName": None,
                "isGeneralRequest": True,
                "subCategory": request_data.subCategory,
                "location": request_data.location,
                "createdAt": datetime.utcnow(),
            }
        else:
            # Specific provider request
            provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
            if not provider:
                raise HTTPException(status_code=404, detail="Provider not found")
            
            request_dict = {
                "customerId": current_user.id,
                "providerId": provider_id,
                "service": request_data.service,
                "description": request_data.description,
                "preferredDateTime": request_data.preferredDateTime,
                "status": "pending",
                "customerName": current_user.name,
                "customerPhone": current_user.phone,
                "providerName": provider["name"],
                "isGeneralRequest": False,
                "subCategory": request_data.subCategory,
                "location": request_data.location,
                "createdAt": datetime.utcnow(),
            }
        
        result = await db.service_requests.insert_one(request_dict)
        request_dict["_id"] = str(result.inserted_id)
        
        return ServiceRequestResponse(**request_dict)
    except Exception as e:
        logger.error(f"Error creating service request: {str(e)}")
        raise

# Support & Feedback Models
class FeedbackRequest(BaseModel):
    type: str  # "feedback", "support", "report"
    subject: str
    message: str
    providerId: Optional[str] = None
    providerName: Optional[str] = None

class WaitlistRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    userName: str
    userEmail: str
    type: str
    subject: str
    message: str
    providerId: Optional[str] = None
    providerName: Optional[str] = None
    status: str
    createdAt: datetime
    
    class Config:
        populate_by_name = True

# Support & Feedback Routes
@api_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    feedback_data: FeedbackRequest,
    current_user: User = Depends(get_current_user)
):
    feedback_dict = {
        "userId": current_user.id,
        "userName": current_user.name,
        "userEmail": current_user.email,
        "type": feedback_data.type,
        "subject": feedback_data.subject,
        "message": feedback_data.message,
        "providerId": feedback_data.providerId,
        "providerName": feedback_data.providerName,
        "status": "pending",
        "createdAt": datetime.utcnow(),
    }
    
    result = await db.feedback.insert_one(feedback_dict)
    feedback_dict["_id"] = str(result.inserted_id)
    
    logger.info(f"Feedback submitted: type={feedback_data.type}, subject={feedback_data.subject}")
    
    return FeedbackResponse(**feedback_dict)

# Waitlist endpoint (no auth required)
@api_router.post("/waitlist")
async def join_waitlist(waitlist_data: WaitlistRequest):
    # Check if email already on waitlist
    existing = await db.waitlist.find_one({"email": waitlist_data.email})
    if existing:
        return {"message": "You're already on the waitlist!", "status": "existing"}
    
    waitlist_entry = {
        "email": waitlist_data.email,
        "name": waitlist_data.name,
        "createdAt": datetime.utcnow(),
    }
    
    await db.waitlist.insert_one(waitlist_entry)
    logger.info(f"New waitlist signup: {waitlist_data.email}")
    
    return {"message": "You've been added to the waitlist!", "status": "success"}

@api_router.get("/service-requests", response_model=List[ServiceRequestResponse])
async def get_service_requests(current_user: User = Depends(get_current_user)):
    # Filter by role
    if current_user.currentRole == "customer":
        query = {"customerId": current_user.id}
    else:
        # Find provider profile first
        provider = await db.providers.find_one({"userId": current_user.id})
        if not provider:
            return []
        
        # Providers see their specific requests AND all general "other services" requests
        query = {
            "$or": [
                {"providerId": str(provider["_id"])},  # Requests specifically for this provider
                {"isGeneralRequest": True}  # General requests visible to all providers
            ]
        }
    
    requests = await db.service_requests.find(query).sort("createdAt", -1).to_list(100)
    result = []
    for req in requests:
        req["_id"] = str(req["_id"])
        # Ensure fields exist for backward compatibility
        if "isGeneralRequest" not in req:
            req["isGeneralRequest"] = False
        if "subCategory" not in req:
            req["subCategory"] = None
        if "location" not in req:
            req["location"] = None
        result.append(ServiceRequestResponse(**req))
    return result

@api_router.patch("/service-requests/{request_id}/accept", response_model=ServiceRequestResponse)
async def accept_request(request_id: str, current_user: User = Depends(get_current_user)):
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "accepted"}}
    )
    
    updated_request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not updated_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    updated_request["_id"] = str(updated_request["_id"])
    return ServiceRequestResponse(**updated_request)

@api_router.patch("/service-requests/{request_id}/decline", response_model=ServiceRequestResponse)
async def decline_request(request_id: str, current_user: User = Depends(get_current_user)):
    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "declined"}}
    )
    
    updated_request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not updated_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    updated_request["_id"] = str(updated_request["_id"])
    return ServiceRequestResponse(**updated_request)

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
