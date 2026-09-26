"""Festival engine for calculating and managing festivals."""

from datetime import datetime, timedelta

from app.core.astronomy import SwissEphemeris, calculate_tithi


def get_recurring_festivals(year: int = None, tradition: str | None = None) -> list[dict]:
    """Return a list of festivals for *year*.

    The function now calculates lunar‑based festivals (e.g., Diwali, Holi) and
    solar‑based festivals (e.g., Makar Sankranti) on the fly using the
    simplified Swiss‑Ephemeris logic in :mod:`backend.app.core.astronomy`.
    Fixed national observances are appended unchanged.
    """
    if year is None:
        year = datetime.now().year

    # Imports already available at module level; no need to import again here.

    # Helper: month names in Vedic calendar (start with Chaitra).
    month_names = [
        "Chaitra",
        "Vaishakha",
        "Jyeshtha",
        "Ashadha",
        "Shravana",
        "Bhadrapada",
        "Ashwin",
        "Kartika",
        "Margashirsha",
        "Pausha",
        "Magha",
        "Phalguna",
    ]

    # Tithis are observed at sunrise. The astronomy helpers accept naive
    # local wall-clock times, so use sunrise in the default Indian timezone.
    start = datetime(year, 1, 1, 6)
    days = [start + timedelta(days=i) for i in range(366) if start + timedelta(days=i) < datetime(year + 1, 1, 1, 6)]
    current_month = None
    festivals = []
    sakranti_recorded = False
    autumn_festivals_recorded = set()

    for dt in days:
        sun_pos = SwissEphemeris.calculate_sun_position(dt)
        moon_pos = SwissEphemeris.calculate_moon_position(dt)
        tithi = calculate_tithi(dt, sun_pos["longitude"], moon_pos["longitude"])

        # A lunar month is named from the sidereal solar sign at its new moon.
        # That name remains in effect until the next new moon.
        if tithi["name"] == "Amavasya" and tithi["paksha"] == "Krishna":
            sidereal_sun = (sun_pos["longitude"] - 27) % 360
            solar_sign = int(sidereal_sun // 30)
            current_month = month_names[(solar_sign + 1) % 12]

        # Makar Sankranti is the Sun's sidereal ingress into Capricorn.
        sidereal_sun = (sun_pos["longitude"] - 27) % 360
        if not sakranti_recorded and sidereal_sun >= 270:
            festivals.append(
                {
                    "name": "Makar Sankranti",
                    "date": dt.strftime("%Y-%m-%d"),
                    "significance": "Sun enters Capricorn",
                    "type": "solar",
                }
            )
            sakranti_recorded = True

        # Lunar festivals based on tithi and month.
        if tithi["name"] == "Amavasya" and tithi["paksha"] == "Krishna":
            if current_month == "Kartika":
                festivals.append(
                    {
                        "name": "Diwali",
                        "date": dt.strftime("%Y-%m-%d"),
                        "significance": "Festival of lights on Kartika Amavasya",
                        "type": "lunar",
                    }
                )
            elif current_month == "Phalguna":
                festivals.append(
                    {
                        "name": "Holi",
                        "date": dt.strftime("%Y-%m-%d"),
                        "significance": "Festival of colors on Phalguna Amavasya",
                        "type": "lunar",
                    }
                )

        if tithi["name"] == "Panchami" and tithi["paksha"] == "Shukla" and current_month == "Vaishakha":
            festivals.append(
                {
                    "name": "Vasant Panchami",
                    "date": dt.strftime("%Y-%m-%d"),
                    "significance": "Spring festival honoring Saraswati",
                    "type": "lunar",
                }
            )

        if dt.month == 10 and tithi["paksha"] == "Shukla":
            if tithi["name"] == "Pratipada" and "Navratri begins" not in autumn_festivals_recorded:
                festivals.append({"name": "Navratri begins", "date": dt.strftime("%Y-%m-%d"), "significance": "Hindu observance", "type": "lunar"})
                autumn_festivals_recorded.add("Navratri begins")
            elif tithi["name"] == "Dashami" and "Dussehra" not in autumn_festivals_recorded:
                festivals.append({"name": "Dussehra", "date": dt.strftime("%Y-%m-%d"), "significance": "Hindu observance", "type": "lunar"})
                autumn_festivals_recorded.add("Dussehra")

    # Append fixed national dates.
    fixed = [
        {"name": "Republic Day", "date": f"{year}-01-26", "significance": "National observance", "type": "national"},
        {"name": "Gandhi Jayanti", "date": f"{year}-10-02", "significance": "National observance", "type": "national"},
        {"name": "Independence Day", "date": f"{year}-08-15", "significance": "National observance", "type": "national"},
        {"name": "Christmas", "date": f"{year}-12-25", "significance": "Christian observance", "type": "national"},
    ]

    regional = {
        "Tamil": ("Tamil New Year", "Solar new year in the Tamil calendar", "04-14"),
        "Telugu": ("Ugadi", "Telugu New Year observance", "03-22"),
        "Kannada": ("Yugadi", "Kannada New Year observance", "03-22"),
        "Malayalam": ("Vishu", "Solar new year observance in Kerala", "04-14"),
    }
    if tradition in regional:
        name, significance, month_day = regional[tradition]
        fixed.append({"name": name, "date": f"{year}-{month_day}", "significance": significance, "type": "regional", "tradition": tradition})

    festivals.extend(fixed)

    # Normalize the calculated and fixed sources into one public occurrence shape.
    normalized = []
    seen = set()
    for festival in festivals:
        name = festival["name"].strip()
        date = festival["date"][:10]
        key = f"{name.casefold()}:{date}"
        if key in seen:
            continue
        seen.add(key)
        normalized.append({
            "id": key.replace(" ", "-"),
            "name": name,
            "date": date,
            "significance": festival.get("significance"),
            "type": festival.get("type", "lunar"),
            "observance": festival.get("observance", "day"),
            "calculation": festival.get("calculation", "derived"),
            "region": festival.get("region", "pan-indian"),
            "tradition": tradition or festival.get("tradition", "Custom"),
        })

    normalized.sort(key=lambda f: (f["date"], f["name"]))
    return normalized


def get_festival_countdown(festival_date_str: str, now: datetime = None) -> dict:
    """Calculate countdown to a festival."""
    now = now or datetime.utcnow()
    
    try:
        from dateutil import parser as date_parser
        festival_date = date_parser.parse(festival_date_str)
    except ImportError:
        # Fallback if python-dateutil not available
        festival_date = datetime.strptime(festival_date_str[:10], "%Y-%m-%d")
    
    delta = (festival_date - now).days
    
    return {
        "festival_date": festival_date,
        "days_until": max(0, delta),
        "is_today": delta <= 0 and delta > -1,
        "has_passed": delta < 0,
    }
