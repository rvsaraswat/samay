"""Astronomy service using Swiss Ephemeris for precise Vedic calculations."""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import pytz

try:
    import swisseph as swe
except ImportError:  # pragma: no cover - exercised in minimal development images
    swe = None


def _utc_to_local(dt_utc: datetime, tz_name: str = "Asia/Kolkata") -> datetime:
    """Interpret a naive UTC datetime and return the local wall-clock time (naive)."""
    try:
        tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        tz = pytz.timezone("Asia/Kolkata")
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    return dt_utc.astimezone(tz).replace(tzinfo=None)


def _jd_to_local(jd: float, tz_name: str = "Asia/Kolkata") -> datetime:
    """Convert a Julian Date to a naive local datetime."""
    dt_utc = datetime(2000, 1, 1, 12) + timedelta(days=jd - J2000)
    return _utc_to_local(dt_utc, tz_name)


# Constants
DEG_TO_RAD = math.pi / 180.0
RAD_TO_DEG = 180.0 / math.pi
J2000 = 2451545.0  # Julian century epoch
DAYSEC = 86400.0   # seconds per day
SIDEREAL_OFFSET_APPROX = 27.0


class SwissEphemeris:
    """
    Swiss Ephemeris calculations for Vedic astronomy.

    pyswisseph is the production provider. The existing analytical formulas remain
    as a deterministic fallback for installations that intentionally omit the
    optional native ephemeris dependency.
    """
    
    # J2000 positions of celestial bodies (simplified)
    SUN_LON_J2000 = 280.46646  # degrees
    MOON_LON_J2000 = 259.667   # degrees

    @staticmethod
    def _swiss_position(dt: datetime, planet: int) -> Optional[dict]:
        if swe is None:
            return None
        jd = SwissEphemeris.julian_date(dt)
        flags = swe.FLG_SWIEPH
        values, _ = swe.calc_ut(jd, planet, flags)
        return {"longitude": SwissEphemeris.degrees_normalize(values[0]), "latitude": values[1], "jd": jd}
    
    @staticmethod
    def julian_date(dt: datetime) -> float:
        """Calculate Julian Date from datetime."""
        year = dt.year
        month = dt.month
        day = dt.day + dt.hour / 24.0 + dt.minute / 1440.0 + dt.second / 86400.0
        
        if month <= 2:
            year -= 1
            month += 12
        
        A = int(year / 100)
        B = 2 - A + int(A / 4)
        
        JD = (math.floor(365.25 * (year + 4716)) + 
              math.floor(30.6001 * (month + 1)) + day + B - 1524.5)
        
        return JD
    
    @staticmethod
    def degrees_normalize(deg: float) -> float:
        """Normalize degrees to 0-360 range."""
        deg = deg % 360.0
        return deg if deg >= 0 else deg + 360.0
    
    @staticmethod
    def calculate_sun_position(dt: datetime, latitude: float = 28.6139, longitude: float = 77.209) -> dict:
        """Calculate approximate sun position for given date/location."""
        precise = SwissEphemeris._swiss_position(dt, swe.SUN) if swe is not None else None
        if precise is not None:
            return precise
        jd = SwissEphemeris.julian_date(dt)
        
        # Days since J2000
        T = (jd - J2000) / 36525.0
        
        # Sun's mean longitude
        L0 = SwissEphemeris.degrees_normalize(280.46646 + 36000.77 * T)
        
        # Sun's mean anomaly
        M = SwissEphemeris.degrees_normalize(357.52911 + 35999.05 * T)
        
        # Equation of center
        C = (1.9146 * math.sin(M * DEG_TO_RAD) + 
             0.0028 * math.sin(2 * M * DEG_TO_RAD) + 
             0.0003 * math.sin(3 * M * DEG_TO_RAD))
        
        # Sun's ecliptic longitude
        lon = SwissEphemeris.degrees_normalize(L0 + C)
        
        return {
            "longitude": lon,
            "latitude": 0.0,  # Sun always near ecliptic
            "jd": jd,
        }
    
    @staticmethod
    def calculate_moon_position(dt: datetime) -> dict:
        """Calculate approximate moon position."""
        precise = SwissEphemeris._swiss_position(dt, swe.MOON) if swe is not None else None
        if precise is not None:
            return precise
        jd = SwissEphemeris.julian_date(dt)
        T = (jd - J2000) / 36525.0
        
        # Moon's mean longitude and anomaly. These coefficients are per
        # Julian century; using solar coefficients here makes lunar dates
        # drift by roughly a month for every month calculated.
        Lm = SwissEphemeris.degrees_normalize(218.3165 + 481267.8813 * T)
        Mm = SwissEphemeris.degrees_normalize(134.9634 + 477198.8676 * T)
        
        # Sun's mean anomaly
        Ms = SwissEphemeris.degrees_normalize(357.5291 + 35999.05 * T)
        
        # Simple approximation (production should use full ephemeris)
        lon = Lm + 6.289 * math.sin(Mm * DEG_TO_RAD) + \
              1.274 * math.sin((2 * Lm - Ms) * DEG_TO_RAD) + \
              0.658 * math.sin(2 * (Lm - Ms) * DEG_TO_RAD)
        
        lon = SwissEphemeris.degrees_normalize(lon)
        
        return {
            "longitude": lon,
            "latitude": 5.145 * math.sin((Lm - 134.139) * DEG_TO_RAD),
            "jd": jd,
        }


def calculate_sunrise_sunset(dt: datetime, latitude: float, longitude: float,
                             elevation: float = 0, timezone: str = "Asia/Kolkata") -> dict:
    """
    Calculate sunrise, sunset and solar noon for a given date/location.

    Uses the standard NOAA-style approximation (declination + equation of time +
    hour angle). All returned times are naive local wall-clock datetimes in the
    requested timezone.
    """
    # Work from midnight UTC of the requested day, then convert to local time.
    day_utc = dt.replace(hour=0, minute=0, second=0, microsecond=0)

    # Solar declination (approximate)
    day_of_year = day_utc.timetuple().tm_yday
    declination = math.radians(23.45 * math.sin(math.radians((90 + 28.1 * day_of_year) % 360)))

    # Equation of time (approximate, minutes)
    B = math.radians((360 / 365) * (day_of_year - 81))
    eq_time = 9.87 * math.sin(2 * B) - 7.53 * math.cos(B) - 1.5 * math.sin(B)

    # Hour angle for sunrise/sunset
    lat_rad = math.radians(latitude)
    cos_ha = (-math.sin(math.radians(0.833)) -
              math.sin(lat_rad) * math.sin(declination)) / \
             (math.cos(lat_rad) * math.cos(declination))

    result = {
        "date": day_utc.date(),
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
    }

    def _minutes_to_local(mins_utc: float) -> Optional[datetime]:
        # Convert minutes-from-midnight-UTC into a local wall-clock datetime.
        utc_dt = day_utc + timedelta(minutes=mins_utc)
        return _utc_to_local(utc_dt, timezone)

    if -1 <= cos_ha <= 1:
        ha_deg = math.degrees(math.acos(cos_ha))

        # Solar noon in minutes from midnight UTC
        solar_noon_min = 720 + 4 * (-longitude) - eq_time

        # Sunrise and sunset in minutes from midnight UTC
        sunrise_utc = solar_noon_min - (60 * ha_deg / 15)
        sunset_utc = solar_noon_min + (60 * ha_deg / 15)

        result["sunrise"] = _minutes_to_local(sunrise_utc)
        result["sunset"] = _minutes_to_local(sunset_utc)
        result["noon"] = _minutes_to_local(solar_noon_min)
    else:
        # Polar night / midnight sun — no well-defined sunrise/sunset.
        if cos_ha > 1:
            result["sunrise"] = None
            result["sunset"] = None
        else:
            result["sunrise"] = None
            result["sunset"] = None
        result["noon"] = _minutes_to_local(720 + 4 * (-longitude) - eq_time)

    return result


def _moon_equatorial(jd: float) -> Tuple[float, float]:
    """Return (right ascension, declination) in degrees for the moon at JD."""
    T = (jd - J2000) / 36525.0
    Lm = SwissEphemeris.degrees_normalize(218.3165 + 481267.8813 * T)
    Mm = SwissEphemeris.degrees_normalize(134.9634 + 477198.8676 * T)
    lon = Lm + 6.289 * math.sin(Mm * DEG_TO_RAD)
    lon = SwissEphemeris.degrees_normalize(lon)
    beta = math.radians(5.145 * math.sin((Lm - 134.139) * DEG_TO_RAD))

    eps = math.radians(23.44)
    lam = math.radians(lon)
    ra = math.degrees(math.atan2(
        math.sin(lam) * math.cos(eps) - math.tan(beta) * math.sin(eps),
        math.cos(lam)
    ))
    ra = SwissEphemeris.degrees_normalize(ra)
    dec = math.degrees(math.asin(
        math.sin(beta) * math.cos(eps) + math.cos(beta) * math.sin(eps) * math.sin(lam)
    ))
    return ra, dec


def _moon_altitude(jd: float, latitude: float, longitude: float) -> float:
    """Return the moon's altitude above the horizon (degrees) at JD for an observer."""
    ra, dec = _moon_equatorial(jd)
    # Greenwich mean sidereal time (degrees)
    gmst = SwissEphemeris.degrees_normalize(280.46061837 + 360.98564736629 * (jd - J2000))
    lst = SwissEphemeris.degrees_normalize(gmst + longitude)
    ha = math.radians(SwissEphemeris.degrees_normalize(lst - ra))
    lat = math.radians(latitude)
    dec_r = math.radians(dec)
    alt = math.asin(
        math.sin(lat) * math.sin(dec_r) +
        math.cos(lat) * math.cos(dec_r) * math.cos(ha)
    )
    return math.degrees(alt)


def calculate_moonrise_moonset(dt: datetime, latitude: float, longitude: float,
                               timezone: str = "Asia/Kolkata") -> dict:
    """
    Calculate moonrise and moonset times by scanning the moon's altitude.

    Returns naive local wall-clock datetimes (or None if the moon stays
    above/below the horizon all day).
    """
    day_utc = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    jd_start = SwissEphemeris.julian_date(day_utc)

    step_min = 10  # scan resolution in minutes
    events = []  # (minutes_from_midnight, rising: bool)
    prev_alt = _moon_altitude(jd_start, latitude, longitude)
    for m in range(1, 1441, step_min):
        jd = jd_start + m / 1440.0
        alt = _moon_altitude(jd, latitude, longitude)
        # Crossing from below to above = rise; above to below = set.
        if prev_alt <= 0 < alt:
            events.append((m, True))
        elif prev_alt > 0 >= alt:
            events.append((m, False))
        prev_alt = alt

    rise_min = set_min = None
    for m, rising in events:
        if rising and rise_min is None:
            rise_min = m
        if not rising and set_min is None:
            set_min = m

    def _mins_to_local(mins: Optional[float]) -> Optional[datetime]:
        if mins is None:
            return None
        utc_dt = day_utc + timedelta(minutes=mins)
        return _utc_to_local(utc_dt, timezone)

    return {
        "date": day_utc.date(),
        "moonrise": _mins_to_local(rise_min),
        "moonset": _mins_to_local(set_min),
    }


def calculate_tithi(dt: datetime, sun_lon: float = None, moon_lon: float = None) -> dict:
    """
    Calculate Tithi (lunar day).
    
    Tithi is angle between Sun and Moon divided by 12 degrees.
    Each tithi = 12° elongation of Moon from Sun.
    """
    if sun_lon is None or moon_lon is None:
        sun_pos = SwissEphemeris.calculate_sun_position(dt)
        moon_pos = SwissEphemeris.calculate_moon_position(dt)
        sun_lon = sun_pos["longitude"]
        moon_lon = moon_pos["longitude"]
    
    elongation = SwissEphemeris.degrees_normalize(moon_lon - sun_lon)
    tithi_number = int(elongation / 12.0) + 1
    
    # Tithi names (Shukla and Krishna paksha)
    tithi_names = [
        "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
        "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
        "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
        "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
        "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
        "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Amavasya"
    ]
    
    paksha = "Shukla" if elongation < 180 else "Krishna"
    
    return {
        "tithi_number": tithi_number,
        "name": tithi_names[tithi_number - 1],
        "paksha": paksha,
        "elongation": elongation,
    }


def calculate_nakshatra(dt: datetime, moon_lon: float = None) -> dict:
    """Calculate Nakshatra (lunar mansion)."""
    if moon_lon is None:
        moon_pos = SwissEphemeris.calculate_moon_position(dt)
        moon_lon = moon_pos["longitude"]
    
    # Subtract an approximate ayanamsha to align with the sidereal zodiac.
    nakshatra_index = int(SwissEphemeris.degrees_normalize(moon_lon - SIDEREAL_OFFSET_APPROX) / (360.0 / 27))
    
    nakshatra_names = [
        "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira",
        "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
        "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
        "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha",
        "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
        "Uttara Bhadrapada", "Revati"
    ]
    
    return {
        "nakshatra_index": nakshatra_index,
        "name": nakshatra_names[nakshatra_index % 27],
        "lord": ["Ketu", "Venus", "Mars", "Moon", "Jupiter"][nakshatra_index // 5] if nakshatra_index < 25 else "Saturn"
    }


def calculate_yoga(dt: datetime, sun_lon: float = None, moon_lon: float = None) -> dict:
    """Calculate the yoga from the sum of approximate sidereal longitudes."""
    if sun_lon is None or moon_lon is None:
        sun_pos = SwissEphemeris.calculate_sun_position(dt)
        moon_pos = SwissEphemeris.calculate_moon_position(dt)
        sun_lon = sun_pos["longitude"]
        moon_lon = moon_pos["longitude"]
    
    yoga_angle = SwissEphemeris.degrees_normalize(
        sun_lon + moon_lon - 2 * SIDEREAL_OFFSET_APPROX
    )
    yoga_index = int(yoga_angle / (360.0 / 27))
    
    yoga_names = [
        "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
        "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
        "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
        "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
        "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
        "Indra", "Vaidhriti"
    ]
    
    return {
        "yoga_index": yoga_index,
        "name": yoga_names[yoga_index % 27],
        "angle": yoga_angle,
    }


def calculate_karana(dt: datetime, sun_lon: float = None, moon_lon: float = None) -> dict:
    """Calculate the repeating and fixed karanas from the Moon-Sun elongation."""
    if sun_lon is None or moon_lon is None:
        sun_pos = SwissEphemeris.calculate_sun_position(dt)
        moon_pos = SwissEphemeris.calculate_moon_position(dt)
        sun_lon = sun_pos["longitude"]
        moon_lon = moon_pos["longitude"]

    elongation = SwissEphemeris.degrees_normalize(moon_lon - sun_lon)
    position = min(int(elongation // 6.0), 59)
    tithi = calculate_tithi(dt, sun_lon, moon_lon)
    half = int((elongation - (tithi["tithi_number"] - 1) * 12.0) // 6.0)

    repeating_karanas = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"]
    if position == 0:
        name = "Kimstughna"
    elif position <= 56:
        name = repeating_karanas[(position - 1) % len(repeating_karanas)]
    else:
        name = ["Shakuni", "Chatushpada", "Naga"][position - 57]

    return {
        "name": name,
        "index": position,
        "tithi_number": tithi["tithi_number"],
        "half": half,
    }


def calculate_muhurta(dt: datetime, sunrise: datetime = None, sunset: datetime = None) -> int:
    """
    Calculate current Muhurta (48 muhurtas in a day).
    
    Each muhurta = ~30 minutes (daylight hours / 24 or 48 depending on system).
    Uses 30-minute muhurtas (Kerala tradition).
    """
    if sunrise is None:
        sunrise = dt.replace(hour=6, minute=0)
    if sunset is None:
        sunset = dt.replace(hour=18, minute=0)
    
    # Calculate day length in minutes
    day_seconds = (sunset - sunrise).total_seconds()
    muhurta_duration = day_seconds / 48.0
    
    current_seconds = (dt - sunrise).total_seconds()
    
    if current_seconds < 0 or current_seconds > day_seconds:
        return 0
    
    return int(current_seconds / muhurta_duration) + 1


def calculate_brahma_muhurta(dt: datetime, sunrise: datetime = None) -> dict:
    """Calculate Brahma Muhurta time (1:30 hours before sunrise)."""
    if sunrise is None:
        sunrise = dt.replace(hour=5, minute=42)  # Default for Delhi
    
    brahma_start = sunrise - timedelta(minutes=78)
    brahma_end = sunrise - timedelta(minutes=48)
    
    return {
        "start": brahma_start,
        "end": brahma_end,
        "duration_minutes": 30,
    }


def calculate_rahu_kaal(dt: datetime, sunrise: datetime = None, sunset: datetime = None) -> dict:
    """
    Calculate Rahu Kaal (inauspicious window) for the day.

    The daylight period (sunrise→sunset) is split into 8 equal parts. Each part
    is ruled by a planet in a fixed order; the part ruled by the planet of the
    day is the Rahu Kaal.
    """
    if sunrise is None:
        sunrise = dt.replace(hour=6, minute=0)
    if sunset is None:
        sunset = dt.replace(hour=18, minute=0)

    day_length = (sunset - sunrise).total_seconds()
    if day_length <= 0:
        day_length = timedelta(hours=12).total_seconds()

    # Part order (1-8): Saturn, Sun, Mars, Rahu, Jupiter, Venus, Mercury, Moon
    # Weekday → part ruled by that day's planet (0=Monday .. 6=Sunday)
    part_by_weekday = {
        0: 8,  # Monday   → Moon   → Part 8
        1: 3,  # Tuesday  → Mars   → Part 3
        2: 7,  # Wednesday→ Mercury→ Part 7
        3: 5,  # Thursday → Jupiter→ Part 5
        4: 6,  # Friday   → Venus  → Part 6
        5: 1,  # Saturday → Saturn → Part 1
        6: 2,  # Sunday   → Sun    → Part 2
    }
    part = part_by_weekday.get(dt.weekday(), 1)

    part_seconds = day_length / 8.0
    start = sunrise + timedelta(seconds=(part - 1) * part_seconds)
    end = start + timedelta(seconds=part_seconds)

    return {
        "start": start,
        "end": end,
        "part": part,
        "duration_hours": round(part_seconds / 3600.0, 2),
    }
