"""Festival API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.models import Festival
from app.services.festival_service import get_recurring_festivals
from app.schemas.schemas import (
    FestivalTodayResponse, FestivalUpcomingRequest, 
    FestivalItem, FestivalUpcomingResponse, FestivalCalendarItem, FestivalCalendarResponse,
)

router = APIRouter(prefix="/festival", tags=["Festivals"])


@router.get("/calendar", response_model=FestivalCalendarResponse)
def get_festival_calendar(
    year: int = Query(ge=2020, le=2100),
    month: int = Query(ge=1, le=12),
    tradition: str | None = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
):
    """Return catalog and locally-managed festivals for a calendar month."""
    catalog = [
        FestivalCalendarItem(
            name=festival["name"],
            date=datetime.strptime(festival["date"], "%Y-%m-%d"),
            significance=festival["significance"],
            type=festival["type"],
            observance=festival["observance"],
            calculation=festival["calculation"],
            region=festival["region"],
            tradition=festival["tradition"],
        )
        for festival in get_recurring_festivals(year, tradition)
        if datetime.strptime(festival["date"], "%Y-%m-%d").month == month
    ]
    start = datetime(year, month, 1)
    end = datetime(year + (month == 12), (month % 12) + 1, 1)
    stored = db.query(Festival).filter(Festival.date >= start, Festival.date < end).all()
    events = {event.name: event for event in catalog}
    for festival in stored:
        events[festival.name] = FestivalCalendarItem(
            name=festival.name,
            date=festival.date,
            significance=festival.significance,
            observance_details=festival.observance_details,
        )
    return FestivalCalendarResponse(year=year, month=month, festivals=sorted(events.values(), key=lambda event: event.date))


def _calculate_festival_countdown(festival_date: datetime, now: datetime | None = None) -> dict:
    """Calculate days/hours/minutes until a festival."""
    now = now or datetime.utcnow()
    delta = festival_date - now
    days = max(0, int(delta.total_seconds() / 86400))
    return {"days": days}


@router.get("/today", response_model=FestivalTodayResponse)
def get_today_festivals(db: Session = Depends(get_db)):
    """Get today's festivals."""
    now = datetime.utcnow()
    start = now.replace(hour=0, minute=0, second=0)
    end = start + timedelta(days=1)
    
    festivals = db.query(Festival).filter(
        Festival.date >= start, 
        Festival.date < end
    ).order_by(Festival.date).all()
    
    return FestivalTodayResponse(festivals=[FestivalItem.from_orm(f) for f in festivals])


@router.get("/upcoming", response_model=FestivalUpcomingResponse)
def get_upcoming_festivals(
    db: Session = Depends(get_db),
    days_ahead: int = Query(default=30, ge=1, le=365),
):
    """Get upcoming festivals within specified days."""
    now = datetime.utcnow()
    start = now.replace(hour=0, minute=0, second=0)
    end = start + timedelta(days=days_ahead)
    
    festivals = db.query(Festival).filter(
        Festival.date >= start, 
        Festival.date < end
    ).order_by(Festival.date).all()
    
    return FestivalUpcomingResponse(festivals=[FestivalItem.from_orm(f) for f in festivals])
