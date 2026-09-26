"""Cosmic API adapters built on the authoritative root Panchanga engine."""

import calendar
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
  festivals = [{"name": name, "date": date_text, "marker": marker}
               for marker, date_text, name in entries if date_text]
  if festival_name:
    needle = festival_name.casefold()
    festivals = [item for item in festivals if needle in item["name"].casefold()]
  return {"year": year, "month": month, "location": location.name, "festivals": festivals}
