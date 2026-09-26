#!/usr/bin/env python3
"""Minimal web UI for generating one-page panchanga calendar PDFs."""

import io
import ipaddress
import json
import logging
import sys
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

from flask import (
  Flask,
  abort,
  jsonify,
  render_template,
  request,
  send_file,
)

# Repo root (parent of this package) so core modules import cleanly when
# launched as ``python -m webapp.app`` or via gunicorn ``webapp.app:app``.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
  sys.path.insert(0, str(_REPO_ROOT))

from generate_panchanga_calendar import (
  city_locations,
  configure_logging,
  load_location,
  location_slug,
  require_coordinate_selection,
  require_month_system,
  require_start_month,
  resolve_location,
)
from festival_rules import FESTIVAL_RULES
from panchanga import sweph_version
from webapp.day_panchanga import compute_day_panchanga
from webapp.pdf_service import generate_pdf
from webapp.ics_service import generate_ics
from webapp.cosmic_api import (
  cosmic_current,
  cosmic_date,
  cosmic_festivals,
  cosmic_calendar_month,
  cosmic_timeline,
  cosmic_birth,
  cosmic_events,
  cosmic_knowledge,
)

configure_logging()
app = Flask(__name__)
log = logging.getLogger(__name__)
log.addHandler(logging.NullHandler())

_CITY_NAMES = None


@app.context_processor
def inject_sweph_version():
  return {"sweph_version": sweph_version()}


def city_names():
  global _CITY_NAMES
  if _CITY_NAMES is None:
    _CITY_NAMES = tuple(sorted(city_locations().keys(), key=str.casefold))
  return _CITY_NAMES


def search_cities(query, limit=20):
  query = query.strip()
  if not query:
    return []
  folded = query.casefold()
  records = city_locations()
  starts = []
  contains = []
  for name in city_names():
    name_folded = name.casefold()
    base_folded = name_folded.rsplit(", ", 1)[0]
    if name_folded.startswith(folded) or base_folded.startswith(folded):
      starts.append(name)
    elif folded in name_folded:
      contains.append(name)
  sort_key = lambda name: (-int(records[name].get("population") or 0), name.casefold())
  starts.sort(key=sort_key)
  contains.sort(key=sort_key)
  return (starts + contains)[:limit]


def city_search_limit(raw_limit):
  """Parse a city-search limit, defaulting invalid input to 20 and capping at 50."""
  try:
    limit = int(raw_limit)
  except (TypeError, ValueError):
    limit = 20
  return min(max(limit, 1), 50)


def suggest_city_for_ip(ip):
  """Public IP → ip-api.com city → cities.json key, or None."""
  try:
    if not ip or not ipaddress.ip_address(ip.strip()).is_global:
      return None
    url = ("http://ip-api.com/json/" + quote(ip.strip()) + "?fields=status,city,countryCode")
    with urlopen(url, timeout=1.5) as resp:
      data = json.loads(resp.read().decode())
    if data.get("status") != "success":
      return None
    return load_location(f"{data['city']}, {data['countryCode']}").name
  except (ValueError, KeyError, TypeError, OSError, TimeoutError, json.JSONDecodeError) as error:
    log.error("City suggestion failed for IP %r: %s", ip, error)
    return None


@app.get("/")
def index():
  return render_template("index.html", mode="calendar")


@app.get("/today")
@app.get("/cosmos")
@app.get("/time-machine")
def cosmic_dashboard():
  return render_template("cosmic.html", mode=request.path.strip("/") or "today")


@app.get("/festivals")
@app.get("/events")
@app.get("/knowledge")
@app.get("/birth-snapshot")
@app.get("/muhurtas")
@app.get("/settings")
def portal_page():
  return render_template("portal.html", mode=request.path.strip("/"))


@app.get("/knowledge/<slug>")
def knowledge_topic_page(slug):
  return render_template("portal.html", mode=f"knowledge/{slug}")


@app.get("/api/search")
def api_search():
  query = (request.args.get("q") or "").strip().casefold()
  if not query:
    return jsonify({"results": []})
  results = []
  for name in city_names():
    if query in name.casefold():
      results.append({"type": "location", "name": name, "url": "/cosmos"})
  for rule in FESTIVAL_RULES:
    if query in rule.name.casefold():
      results.append({"type": "festival", "name": rule.name, "url": "/festivals"})
  for topic in cosmic_knowledge()["topics"]:
    if query in topic["slug"].casefold() or query in topic["title"].casefold():
      results.append({"type": "knowledge", "name": topic["title"], "url": f"/knowledge/{topic['slug']}"})
  return jsonify({"query": query, "results": results[:50]})


@app.get("/api/cities")
def api_cities():
  query = request.args.get("q", "")
  limit = city_search_limit(request.args.get("limit", 20))
  return jsonify({"cities": search_cities(query, limit=limit)})


def client_ip(xff, remote):
  """First X-Forwarded-For hop, else direct remote address."""
  ip = xff.split(",")[0].strip() if xff else (remote or "").strip()
  return ip


@app.get("/api/suggest-city")
def api_suggest_city():
  ip = client_ip(request.headers.get("X-Forwarded-For", ""), request.remote_addr)
  return jsonify({"city": suggest_city_for_ip(ip)})


@app.get("/api/panchanga")
def api_panchanga():
  city = (request.args.get("city") or "").strip()
  date = (request.args.get("date") or "").strip()
  month = request.args.get("month")
  ayanamsa = request.args.get("ayanamsa")
  latitude = (request.args.get("latitude") or "").strip()
  longitude = (request.args.get("longitude") or "").strip()
  timezone = (request.args.get("timezone") or "").strip()
  try:
    if ayanamsa:
      ayanamsa = ayanamsa.strip()
    coordinate_selection = require_coordinate_selection(ayanamsa)
    if month:
      month = month.strip()
    return jsonify(
      compute_day_panchanga(city, date, month_system=month, coordinate_selection=coordinate_selection,
                            latitude=latitude, longitude=longitude, timezone=timezone))
  except ValueError as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/current")
def api_cosmic_current():
  try:
    return jsonify(cosmic_current(request.args))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/date")
def api_cosmic_date():
  try:
    return jsonify(cosmic_date(request.args))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/timeline")
def api_cosmic_timeline():
  try:
    return jsonify(cosmic_timeline(request.args))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/transitions")
def api_cosmic_transitions():
  try:
    result = cosmic_date(request.args)
    return jsonify({"date": result["date"], "location": result["location"],
                    "transitions": result["transitions"]})
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/planet/<planet>")
def api_cosmic_planet(planet):
  try:
    result = cosmic_date(request.args)
    aliases = {"sun": "surya", "moon": "candra", "mars": "mangala", "mercury": "budha",
               "jupiter": "guru", "venus": "sukra", "saturn": "sani"}
    wanted = aliases.get(planet.casefold(), planet.casefold())
    match = next((item for item in result["planets"] if item["planet"].casefold() == wanted), None)
    if match is None:
      abort(404, description=f"Unknown planet {planet!r}")
    return jsonify({"date": result["date"], "location": result["location"], "planet": match})
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/festivals")
def api_cosmic_festivals():
  try:
    return jsonify(cosmic_festivals(request.args))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/festival/<festival>")
def api_cosmic_festival(festival):
  try:
    return jsonify(cosmic_festivals(request.args, festival_name=festival))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/year/<int:year>")
def api_cosmic_year(year):
  try:
    items = [cosmic_festivals(request.args, year=year, month=month) for month in range(1, 13)]
    return jsonify({"year": year, "location": items[0]["location"],
                    "festivals": [festival for item in items for festival in item["festivals"]]})
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/month/<int:month>")
def api_cosmic_month(month):
  try:
    return jsonify(cosmic_festivals(request.args, month=month))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/calendar/month/<int:month>")
def api_calendar_month(month):
  try:
    return jsonify(cosmic_calendar_month(request.args, month=month))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/birth")
def api_cosmic_birth():
  try:
    return jsonify(cosmic_birth(request.args))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/cosmic/events")
def api_cosmic_events():
  try:
    return jsonify(cosmic_events(request.args))
  except (KeyError, TypeError, ValueError, OSError, RuntimeError) as error:
    abort(400, description=str(error))


@app.get("/api/knowledge")
def api_knowledge():
  return jsonify(cosmic_knowledge())


@app.get("/api/knowledge/<slug>")
def api_knowledge_topic(slug):
  try:
    return jsonify(cosmic_knowledge(slug))
  except KeyError:
    abort(404, description=f"Unknown knowledge topic {slug!r}")


@app.post("/generate")
def generate():
  try:
    pdf_bytes, filename = generate_pdf(request.form)
  except (OSError, ValueError, RuntimeError) as error:
    abort(400, description=str(error))
  return send_file(io.BytesIO(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name=filename,
                   max_age=0)


@app.get("/api/panchanga.ics")
def ics_calendar():
  city = (request.args.get("city") or "").strip()
  latitude = (request.args.get("latitude") or "").strip()
  longitude = (request.args.get("longitude") or "").strip()
  timezone = (request.args.get("timezone") or "").strip()
  start = (request.args.get("start") or "").strip()
  try:
    location = resolve_location(city, latitude, longitude, timezone)
    start_year, start_month = require_start_month(start)
    month = (request.args.get("month") or "amanta").strip()
    amanta = require_month_system(month)
    month_key = "amanta" if amanta else "purnimanta"
    coordinate_selection = require_coordinate_selection((request.args.get("ayanamsa") or "").strip() or None)
    ics_text = generate_ics(location, start_year, start_month, month_system=month,
                            coordinate_selection=coordinate_selection)
  except (OSError, ValueError, RuntimeError) as error:
    abort(400, description=str(error))
  name = (f"panchanga-{location_slug(location.name)}-{coordinate_selection}-{month_key}-"
          f"{start_year:04d}-{start_month:02d}.ics")
  return send_file(io.BytesIO(ics_text.encode("utf-8")), mimetype="text/calendar; charset=utf-8", as_attachment=True,
                   download_name=name, max_age=0)


@app.errorhandler(400)
def bad_request(error):
  message = getattr(error, "description", None) or "Bad request"
  if request.accept_mimetypes.best == "application/json" or request.path.startswith("/api/"):
    return jsonify({"error": message}), 400
  return render_template("index.html", error=message), 400


def main():
  import argparse
  import os

  parser = argparse.ArgumentParser(description="Serve the panchanga PDF web UI.")
  parser.add_argument("--host", default=os.environ.get("PANCHANGA_HOST", "0.0.0.0"),
                      help="bind address (default: 0.0.0.0, or PANCHANGA_HOST)")
  parser.add_argument(
    "--port",
    type=int,
    # Railway/Heroku set PORT; local default remains 8765.
    default=int(os.environ.get("PORT") or os.environ.get("PANCHANGA_PORT") or "8765"),
    help="TCP port (default: PORT / PANCHANGA_PORT / 8765)")
  parser.add_argument("--debug", action="store_true", help="enable Flask debug reloader")
  args = parser.parse_args()
  # 0.0.0.0 so the UI is reachable from other devices on the LAN.
  app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
  main()
