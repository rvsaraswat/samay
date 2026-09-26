"""Cosmic API adapters built on the authoritative root Panchanga engine."""

import calendar
import re
from datetime import datetime, timedelta, timezone

import panchanga
from datetime_helper import gregorian_to_jd
from festival_rules import resolve_festivals
from generate_panchanga_calendar import daily_records, place_for_date, resolve_location, sanskrit_names
from webapp.day_panchanga import compute_day_panchanga, parse_civil_date

DEFAULT_CITY = "New Delhi, IN"


def _planet_label(planet):
  labels = {
    panchanga.swe.URANUS: "Uranus",
    panchanga.swe.NEPTUNE: "Neptune",
  }
  if planet in labels:
    return labels[planet]
  return panchanga.get_planet_name(planet)


def _date_text(civil):
  return f"{civil.day:02d}/{civil.month:02d}/{civil.year}"


def _civil_from_iso(value):
  value = (value or "").strip()
  if not value:
    raise ValueError("date is required (YYYY-MM-DD or DD/MM/YYYY)")
  if "T" in value:
    value = value.split("T", 1)[0]
  if "-" in value:
    parts = value.split("-")
    if len(parts) != 3:
      raise ValueError("date must be YYYY-MM-DD or DD/MM/YYYY")
    try:
      year, month, day = (int(part) for part in parts)
    except ValueError:
      raise ValueError("date must be YYYY-MM-DD or DD/MM/YYYY") from None
    return parse_civil_date(f"{day:02d}/{month:02d}/{year}")
  return parse_civil_date(value)


def _location(args):
  city = (args.get("city") or DEFAULT_CITY).strip()
  return resolve_location(city, (args.get("latitude") or "").strip(),
                          (args.get("longitude") or "").strip(),
                          (args.get("timezone") or "").strip())


def _options(args):
  return (args.get("month") or "amanta").strip(), (args.get("ayanamsa") or "citra").strip()


def _planet_rows(location, civil, coordinate_selection="citra", hour=12.0):
  names = sanskrit_names()
  place = place_for_date(location, civil)
  local_jd = gregorian_to_jd(civil) + hour / 24.0
  jd_ut = local_jd - place.timezone / 24.0
  with panchanga.coordinate_calculation_lock:
    panchanga.set_coordinate_selection(coordinate_selection)
    rows = []
    for planet in panchanga.planet_list:
      label = _planet_label(planet)
      longitude = (panchanga.ketu(panchanga.planet_longitude(jd_ut, panchanga.swe.RAHU))
                   if planet == panchanga.swe.KETU else panchanga.planet_longitude(jd_ut, planet))
      later = (panchanga.ketu(panchanga.planet_longitude(jd_ut + 1 / 1440, panchanga.swe.RAHU))
               if planet == panchanga.swe.KETU else panchanga.planet_longitude(jd_ut + 1 / 1440, planet))
      speed = (later - longitude + 180.0) % 360.0 - 180.0
      rashi = int(longitude // 30) + 1
      nakshatra, pada = panchanga.nakshatra_pada(longitude)
      latitude = 0.0
      if planet not in (panchanga.swe.KETU, panchanga.swe.MEAN_NODE):
        flags = panchanga.swe.FLG_SWIEPH | panchanga.coordinate_flag
        panchanga.set_ayanamsa_mode()
        try:
          values, _ = panchanga.swe.calc_ut(jd_ut, planet, flags=flags)
        finally:
          panchanga.reset_ayanamsa_mode()
        latitude = float(values[1])
      rows.append({
        "planet": label,
        "body": int(planet),
        "longitude": round(longitude, 8),
        "latitude": round(latitude, 8),
        "rashi_number": rashi,
        "rashi": names["zodiac"][str(rashi - 1)],
        "nakshatra_number": nakshatra,
        "nakshatra": names["nakshatras"][str(nakshatra)],
        "pada": pada,
        "speed": round(speed * 1440.0, 8),
        "retrograde": speed < -0.00001 and label not in ("Rahu", "Ketu"),
      })
    return rows


def _transition_rows(day):
  rows = []
  for key, kind in (("tithi", "tithi"), ("nakshatra", "nakshatra"),
                    ("yoga", "yoga"), ("karana", "karana")):
    for segment in day[key]:
      rows.append({"type": kind, "name": segment["name"], "ends": segment["ends"],
                   "source": f"panchanga.{kind}"})
  return rows


def cosmic_date(args, civil=None):
  location = _location(args)
  civil = civil or _civil_from_iso(args.get("date"))
  month_system, coordinate_selection = _options(args)
  day = compute_day_panchanga(location.name, _date_text(civil), month_system=month_system,
                              coordinate_selection=coordinate_selection)
  return {
    "engine": {"name": "Drik Panchanga", "module": "panchanga.py", "coordinate_mode": day["coordinate_mode"],
               "ayanamsa": day["ayanamsa_key"]},
    "location": {"name": location.name, "latitude": location.latitude, "longitude": location.longitude,
                 "timezone": location.timezone_name},
    "date": day["date"],
    "panchanga": day,
    "planets": _planet_rows(location, civil, coordinate_selection),
    "transitions": _transition_rows(day),
  }


def cosmic_current(args):
  location = _location(args)
  from zoneinfo import ZoneInfo
  today = datetime.now(ZoneInfo(location.timezone_name))
  return cosmic_date(args, panchanga.Date(today.year, today.month, today.day))


def cosmic_timeline(args):
  start = _civil_from_iso(args.get("date"))
  count = min(max(int(args.get("days", 7)), 1), 31)
  items = []
  for offset in range(count):
    civil = panchanga.Date(start.year, start.month, start.day)
    if offset:
      anchor = datetime(start.year, start.month, start.day) + timedelta(days=offset)
      civil = panchanga.Date(anchor.year, anchor.month, anchor.day)
    snapshot = cosmic_date(args, civil)
    items.append({"date": snapshot["date"], "transitions": snapshot["transitions"],
                  "panchanga": snapshot["panchanga"]})
  return {"location": items and cosmic_date(args, start)["location"], "days": items}


def cosmic_festivals(args, year=None, month=None, festival_name=None):
  location = _location(args)
  now = datetime.now(timezone.utc)
  year = int(year or args.get("year") or now.year)
  month = int(month or args.get("month_number") or 1)
  records = daily_records([(year, month)], location)
  dates = {record.civil_date for record in records}
  _markers, entries = resolve_festivals(records, dates,
                                        geopos=(location.longitude, location.latitude, 0),
                                        timezone_name=location.timezone_name)
  festivals = [{"name": name, "date": date_text, "year": year, "month": month,
                "marker": marker, "category": _festival_category(name)}
               for marker, date_text, name in entries
               if date_text and date_text != "None"]
  if festival_name:
    needle = festival_name.casefold()
    festivals = [item for item in festivals if needle in item["name"].casefold()]
  return {"year": year, "month": month, "location": location.name, "festivals": festivals}


def _festival_category(name):
  lowered = name.casefold()
  if "sankranti" in lowered or "ayana" in lowered:
    return "sankranti"
  if any(term in lowered for term in ("independence", "republic", "gandhi", "christmas", "new year")):
    return "national"
  return "regional"


def cosmic_calendar_month(args, year=None, month=None):
  """Return one canonical calendar model for a Gregorian month."""
  location = _location(args)
  now = datetime.now(timezone.utc)
  year = int(year or args.get("year") or now.year)
  month = int(month or args.get("month_number") or now.month)
  records = daily_records([(year, month)], location)
  festival_data = cosmic_festivals(args, year=year, month=month)
  events_by_day = {}
  for item in festival_data["festivals"]:
    numbers = re.findall(r"\d+", str(item.get("date") or ""))
    if not numbers:
      continue
    day = int(numbers[-1])
    name = item["name"]
    events_by_day.setdefault(day, []).append({"name": name, "category": item.get("category", "regional"), "marker": item.get("marker")})
  days = []
  for record in records:
    tithi_number = int(record.tithi[1:]) + (15 if record.tithi.startswith("K") else 0)
    tithi_event = {"name": record.tithi, "category": "tithi"}
    if tithi_number == 11 or tithi_number == 26:
      tithi_event["category"] = "ekadashi"
    elif tithi_number == 15:
      tithi_event["category"] = "purnima"
    elif tithi_number == 30:
      tithi_event["category"] = "amavasya"
    days.append({
      "date": f"{year:04d}-{month:02d}-{record.civil_date.day:02d}",
      "day": record.civil_date.day,
      "tithi": record.tithi,
      "tithi_event": tithi_event,
      "events": [tithi_event, *events_by_day.get(record.civil_date.day, [])],
    })
  return {"year": year, "month": month, "location": location.name, "days": days}


KNOWLEDGE = {
  "panchanga": {"title": "Panchanga", "summary": "The five-part Indian lunisolar almanac.",
                "body": "Panchanga brings together Tithi, Vara, Nakshatra, Yoga, and Karana. Ghadi anchors these values to the local sunrise and exposes the exact engine output behind each one."},
  "tithi": {"title": "Tithi", "summary": "A lunar day measured by the Sun-Moon angle.",
            "body": "One Tithi spans 12 degrees of lunar elongation. The Drik engine determines the Tithi at local sunrise and interpolates its ending instant."},
  "nakshatra": {"title": "Nakshatra", "summary": "The Moon's passage through 27 stellar sectors.",
                 "body": "Each Nakshatra covers a segment of the sidereal ecliptic and is divided into four Padas. Ghadi uses the configured Nakshatra system from the engine."},
  "yoga": {"title": "Yoga", "summary": "A division based on the combined sidereal longitudes.",
           "body": "The Sun and Moon longitudes are added and divided into 27 equal Yogas. The resulting sunrise Yoga and ending time come directly from panchanga.py."},
  "karana": {"title": "Karana", "summary": "Half of a Tithi.",
              "body": "A Karana spans six degrees of lunar elongation. Four fixed and seven repeating Karanas organize the lunar day."},
  "ayanamsha": {"title": "Ayanamsha", "summary": "The sidereal reference offset.",
                "body": "Ayanamsha defines the relationship between tropical and sidereal longitude. Ghadi exposes the selected Swiss Ephemeris mode in every cosmic response."},
  "muhurta": {"title": "Muhurta", "summary": "A time window selected for a purpose.",
              "body": "Ghadi's sunrise-anchored day record already contains Rahu Kalam, Durmuhurta, Varjyam, and Pratah Sandhya. Future Muhurta rules should consume those same intervals."},
}


def cosmic_birth(args):
  value = (args.get("datetime") or args.get("birth") or "").strip()
  if not value:
    raise ValueError("datetime is required (YYYY-MM-DDTHH:MM)")
  try:
    birth = datetime.fromisoformat(value.replace("Z", "+00:00"))
  except ValueError:
    raise ValueError("datetime must be YYYY-MM-DDTHH:MM") from None
  location = _location(args)
  civil = panchanga.Date(birth.year, birth.month, birth.day)
  result = cosmic_date(args, civil)
  _month_system, coordinate_selection = _options(args)
  result["planets"] = _planet_rows(location, civil, coordinate_selection,
                                    birth.hour + birth.minute / 60 + birth.second / 3600)
  result["birth"] = {"datetime": birth.isoformat(), "label": args.get("label") or "Birth Cosmic Snapshot"}
  return result


def cosmic_events(args):
  snapshot = cosmic_date(args)
  events = [{"type": item["type"], "name": item["name"], "ends": item["ends"],
             "date": snapshot["date"], "source": item["source"]}
            for item in snapshot["transitions"]]
  festivals = cosmic_festivals(args)
  events.extend({"type": "festival", "name": item["name"], "date": item["date"],
                 "source": "festival_rules.py"} for item in festivals["festivals"])
  return {"date": snapshot["date"], "location": snapshot["location"], "events": events}


def cosmic_knowledge(slug=None):
  if slug:
    item = KNOWLEDGE.get(slug.casefold())
    if item is None:
      raise KeyError(slug)
    return {"slug": slug.casefold(), **item}
  return {"topics": [{"slug": key, **value} for key, value in KNOWLEDGE.items()]}
