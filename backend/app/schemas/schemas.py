"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from typing import Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RequestModel(BaseModel):
    """Base model for externally supplied request payloads."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ==================== Auth Schemas ====================

class UserRegister(RequestModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
    full_name: Optional[str] = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).casefold()

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        return value or None


class UserLogin(RequestModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).casefold()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str]
    is_active: bool


# ==================== Preference Schemas ====================

class LocationUpdate(RequestModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation: float = Field(default=0.0, ge=-500, le=10_000)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=64)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Timezone must be a valid IANA timezone") from exc
        return value


class PreferencesUpdate(RequestModel):
    location: Optional[LocationUpdate] = None
    language: Optional[str] = Field(default=None, pattern=r"^[a-z]{2}(?:-[A-Z]{2})?$")
    theme: Optional[Literal["light", "dark", "system"]] = None
    tradition: Optional[Literal["Smarta", "Vaishnava", "ISKCON", "Tamil", "Telugu", "Kannada", "Gujarati", "Maharashtrian", "North Indian", "Custom"]] = None


# ==================== Vedic Time Schemas ====================

class VedicTimeResponse(BaseModel):
    current_time: datetime
    sunrise: Optional[datetime] = None
    sunset: Optional[datetime] = None
    muhurta: Optional[int] = None
    ghati: Optional[float] = None
    vighati: Optional[float] = None
    tithi_name: Optional[str] = None
    nakshatra_name: Optional[str] = None
    yoga_name: Optional[str] = None
    karana_name: Optional[str] = None


# ==================== Panchanga Schemas ====================

class SolarData(BaseModel):
    sunrise: Optional[datetime] = None
    sunset: Optional[datetime] = None
    noon: Optional[datetime] = None
    moonrise: Optional[datetime] = None
    moonset: Optional[datetime] = None


class LunarData(BaseModel):
    tithi_name: Optional[str] = None
    paksha: Optional[str] = None  # Shukla or Krishna
    nakshatra_name: Optional[str] = None
    yoga_name: Optional[str] = None
    karana_name: Optional[str] = None


class TimeWindows(BaseModel):
    brahma_muhurta_start: Optional[datetime] = None
    abhijit_muhurta_start: Optional[datetime] = None
    rahu_kaal_start: Optional[datetime] = None
    rahu_kaal_end: Optional[datetime] = None
    yamaganda_start: Optional[datetime] = None
    yamaganda_end: Optional[datetime] = None
    gulika_start: Optional[datetime] = None
    gulika_end: Optional[datetime] = None


class PanchangaResponse(BaseModel):
    date: datetime
    solar: SolarData
    lunar: LunarData
    time_windows: TimeWindows


class PlanetPosition(BaseModel):
    name: str
    symbol: str
    longitude: float
    latitude: float = 0.0
    rashi: str
    nakshatra: str
    pada: int
    speed: float
    retrograde: bool = False


class CosmicResponse(BaseModel):
    date: datetime
    ayanamsha: str
    ayanamsha_degrees: float
    sun_longitude: float
    moon_longitude: float
    elongation: float
    tithi_number: int
    tithi_name: str
    paksha: str
    nakshatra_name: str
    yoga_name: str
    karana_name: str
    planets: list[PlanetPosition]


class CosmicLocationRequest(RequestModel):
    at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation: float = Field(default=0.0, ge=-500, le=10_000)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=64)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Timezone must be a valid IANA timezone") from exc
        return value


class BirthSnapshotSaveRequest(CosmicLocationRequest):
    name: str = Field(default="Birth snapshot", min_length=1, max_length=100)


class LocationCreate(RequestModel):
    name: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation: float = Field(default=0.0, ge=-500, le=10_000)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=64)
    is_primary: bool = False

    @field_validator("timezone")
    @classmethod
    def validate_location_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Timezone must be a valid IANA timezone") from exc
        return value


class SavedLocationUpdate(RequestModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    elevation: Optional[float] = Field(default=None, ge=-500, le=10_000)
    timezone: Optional[str] = Field(default=None, min_length=1, max_length=64)
    is_primary: Optional[bool] = None

    @field_validator("timezone")
    @classmethod
    def validate_update_timezone(cls, value: str | None) -> str | None:
        if value is not None:
            try:
                ZoneInfo(value)
            except ZoneInfoNotFoundError as exc:
                raise ValueError("Timezone must be a valid IANA timezone") from exc
        return value


# ==================== Festival Schemas ====================

class FestivalItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    date: datetime
    significance: Optional[str] = None
    observance_details: Optional[str] = None
    type: Optional[str] = None
    observance: Optional[str] = None
    calculation: Optional[str] = None
    region: Optional[str] = None
    tradition: Optional[str] = None


class FestivalTodayResponse(BaseModel):
    festivals: list[FestivalItem]


class FestivalUpcomingRequest(RequestModel):
    days_ahead: int = Field(default=30, ge=1, le=365)


class FestivalUpcomingResponse(BaseModel):
    festivals: list[FestivalItem]


class FestivalCalendarItem(BaseModel):
    name: str
    date: datetime
    significance: Optional[str] = None
    observance_details: Optional[str] = None
    type: Optional[str] = None
    observance: Optional[str] = None
    calculation: Optional[str] = None
    region: Optional[str] = None
    tradition: Optional[str] = None


class FestivalCalendarResponse(BaseModel):
    year: int
    month: int
    festivals: list[FestivalCalendarItem]


# ==================== Daily Context Schema ====================

class DailyContextResponse(BaseModel):
    nakshatra_name: Optional[str] = None
    tithi_name: Optional[str] = None
    historical_significance: Optional[str] = None
    traditional_associations: Optional[str] = None
    related_deity: Optional[str] = None


# ==================== Notification Schema ====================

class NotificationPreferences(RequestModel):
    event_type: str = Field(min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    is_enabled: bool = True


class NotificationPreferenceUpdate(RequestModel):
    is_enabled: bool


class DeviceTokenRegister(RequestModel):
    token: str = Field(min_length=1, max_length=500)
    device_type: Literal["ios", "android", "web", "watch"]
    platform: Literal["apns", "fcm", "webpush"]


# ==================== Location Schemas ====================

class SunriseSunsetResponse(BaseModel):
    date: datetime
    sunrise: Optional[datetime] = None
    sunset: Optional[datetime] = None
    moonrise: Optional[datetime] = None
    moonset: Optional[datetime] = None
    noon: Optional[datetime] = None
