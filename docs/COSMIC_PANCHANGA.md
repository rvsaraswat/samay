# Cosmic Panchanga

The `/cosmos` and `/today` views are visual clients of `/api/cosmic/date` and `/api/cosmic/current`. They do not calculate astronomical values in JavaScript.

The response combines the existing sunrise-anchored Panchanga record with instantaneous Swiss Ephemeris positions. The zodiac wheel uses sidereal longitudes, Rashi boundaries, and Nakshatra/Pada values returned by the root `panchanga.py` engine. The planet table exposes longitude, latitude, Rashi, Nakshatra, Pada, daily speed, and retrograde state.

Use `date=YYYY-MM-DD`, `city=City, CC`, and optional `ayanamsa=citra` or another supported selection. The engine remains the source of truth for Tithi, Nakshatra, Yoga, Karana, sunrise, sunset, and lunar events.

The next extension is a dedicated planet drawer and sky reconstruction layer. Those features should consume the same response and never introduce browser-side astronomy.
