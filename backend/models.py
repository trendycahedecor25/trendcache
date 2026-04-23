from pydantic import BaseModel, Field
from typing import Optional


class UserProfile(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: Optional[str] = None


class SessionExchange(BaseModel):
    session_id: str
    referral_code: Optional[str] = None


class ChatMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str


class ChatMessageResponse(BaseModel):
    conversation_id: str
    willow_response: str
    conversation_title: str


class JournalEntryCreate(BaseModel):
    title: str
    content: str
    mood: Optional[str] = None


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood: Optional[str] = None


class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    start_time: str
    end_time: Optional[str] = None
    event_type: Optional[str] = "general"
    reminder: Optional[bool] = False


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    event_type: Optional[str] = None
    reminder: Optional[bool] = None


class MoodEntryCreate(BaseModel):
    mood_score: int = Field(ge=1, le=5)
    mood_label: str
    note: Optional[str] = ""


class CheckoutRequest(BaseModel):
    origin_url: str
