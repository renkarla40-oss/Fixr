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
    print(f"=== VALIDATION ERROR ===")
    print(f"Errors: {exc.errors()}")
    print(f"Request URL: {request.url}")
    print(f"Request method: {request.method}")
    try:
        body = await request.body()
        print(f"Request body: {body.decode()}")
    except:
        print("Could not read request body")
    print(f"======================")
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

class ProviderSetup(BaseModel):
    services: List[str]
    bio: str

class ServiceRequest(BaseModel):
    service: str
    description: str
    preferredDateTime: Optional[datetime] = None
    subCategory: Optional[str] = None  # For handyman sub-categories
    location: Optional[str] = None  # Customer's service location

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
    location: Optional[str] = None  # Customer's service location
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
    result = await db.users.update_one(
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
    # Create or update provider profile
    provider_profile = {
        "userId": current_user.id,
        "services": setup_data.services,
        "bio": setup_data.bio,
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

# Provider Routes
@api_router.get("/providers", response_model=List[Provider])
async def get_providers(service: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"setupComplete": True}
    if service:
        query["services"] = service
    
    providers = await db.providers.find(query).to_list(100)
    result = []
    for provider in providers:
        provider["_id"] = str(provider["_id"])
        result.append(Provider(**provider))
    return result

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
