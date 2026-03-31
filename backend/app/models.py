from pydantic import BaseModel, Field, EmailStr, field_serializer
from typing import List, Optional
from datetime import datetime


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
      profilePhotoUrl: Optional[str] = None
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
      provider: str
      providerId: str
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
      baseTown: str
      travelDistanceKm: int = 16
      travelRadiusMiles: Optional[int] = None
      travelAnywhere: bool = False


class ProviderAvailabilityUpdate(BaseModel):
      availabilityStatus: str


class PhotoUploadRequest(BaseModel):
      imageData: str
      uploadType: str


class CustomerPhotoUploadRequest(BaseModel):
      imageData: str


class SendOTPRequest(BaseModel):
      phone: str


class VerifyOTPRequest(BaseModel):
      phone: str
      otp: str


class OTPResponse(BaseModel):
      success: bool
      message: str


class ConfirmJobStartRequest(BaseModel):
      jobCode: str


class SubmitReviewRequest(BaseModel):
      rating: int
      comment: str


class ServiceRequest(BaseModel):
      service: str
      description: str
      preferredDateTime: Optional[datetime] = None
      subCategory: Optional[str] = None
      location: Optional[str] = None
      jobTown: Optional[str] = None
      searchDistanceKm: int = 16
      searchRadiusMiles: Optional[int] = None
      jobDuration: Optional[str] = None


class ServiceRequestResponse(BaseModel):
      id: str = Field(alias="_id")
      customerId: str
      providerId: Optional[str] = None
      service: str
      description: str
      preferredDateTime: Optional[datetime] = None
      status: str = "pending"
      customerName: str
      customerPhone: Optional[str] = None
      providerName: Optional[str] = None
      isGeneralRequest: bool = False
      subCategory: Optional[str] = None
      location: Optional[str] = None
      jobTown: Optional[str] = None
      searchRadiusMiles: int = 10
      jobDuration: Optional[str] = None
      createdAt: datetime
      acceptedAt: Optional[datetime] = None
      completedAt: Optional[datetime] = None
      paymentStatus: str = "unpaid"
      jobCode: Optional[str] = None
      completionCode: Optional[str] = None
      quoteId: Optional[str] = None
      quotedAmount: Optional[float] = None
      providerPhotoUrl: Optional[str] = None
      customerPhotoUrl: Optional[str] = None
      uploadsComplete: bool = False

    class Config:
              populate_by_name = True


class Provider(BaseModel):
      id: str = Field(alias="_id")
      userId: str
      name: str
      email: str
      phone: str
      services: List[str] = []
      bio: str = ""
      verificationStatus: str = "pending"
      setupComplete: bool = False
      baseTown: Optional[str] = None
      travelRadiusMiles: int = 10
      travelDistanceKm: int = 16
      travelAnywhere: bool = False
      availabilityStatus: str = "available"
      profilePhotoUrl: Optional[str] = None
      governmentIdFrontUrl: Optional[str] = None
      governmentIdBackUrl: Optional[str] = None
      uploadsComplete: bool = False
      createdAt: datetime = Field(default_factory=datetime.utcnow)
      updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
              populate_by_name = True


class AssignProviderRequest(BaseModel):
      providerId: str
      requestId: str


class ReviewCreate(BaseModel):
      jobId: str
      providerId: str
      customerId: str
      rating: int
      comment: str


class Review(BaseModel):
      id: str = Field(alias="_id")
      jobId: str
      providerId: str
      customerId: str
      customerName: str
      rating: int
      comment: str
      createdAt: datetime

    class Config:
              populate_by_name = True


class Notification(BaseModel):
      id: str = Field(alias="_id")
      userId: str
      type: str
      title: str
      body: str
      read: bool = False
      jobId: Optional[str] = None
      providerId: Optional[str] = None
      customerId: Optional[str] = None
      data: Optional[dict] = None
      createdAt: datetime

    class Config:
              populate_by_name = True


class RegisterPushTokenRequest(BaseModel):
      token: str
      platform: Optional[str] = None


class NotificationResponse(BaseModel):
      notifications: List[Notification]
      unreadCount: int


class CreateDraftPaymentRequest(BaseModel):
      requestId: str
      amount: float


class MarkPaidRequest(BaseModel):
      requestId: str
      paymentIntentId: Optional[str] = None


class FeedbackRequest(BaseModel):
      feedback: str
      email: Optional[str] = None
      userId: Optional[str] = None


class WaitlistRequest(BaseModel):
      email: EmailStr
      name: Optional[str] = None


class FeedbackResponse(BaseModel):
      success: bool
      message: str
