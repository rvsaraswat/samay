# Ghadi Architecture Analysis

## System boundary

Ghadi is built on the Drik Panchanga calculation engine in the repository root. The root modules remain authoritative; API and visualization code must consume them rather than reimplement astronomical rules.

## Authoritative engine map

| Capability | Source | Entry points |
|---|---|---|
| Julian dates and calendar conversion | `datetime_helper.py` | `gregorian_to_jd`, `format_hms` |
| Tithi | `panchanga.py` | `tithi`, `lunar_phase` |
| Nakshatra and pada | `panchanga.py` | `nakshatra`, `nakshatra_pada` |
| Yoga | `panchanga.py` | `yoga` |
| Karana | `panchanga.py` | `karana` |
| Sunrise and sunset | `panchanga.py` | `sunrise`, `sunset`, `day_duration` |
| Moonrise and moonset | `panchanga.py` | `moonrise`, `moonset` |
| Planetary positions | `panchanga.py` | `planet_longitude`, `planetary_positions`, `planet_list` |
| Ayanamsha and coordinate mode | `panchanga.py` | `set_coordinate_selection`, `set_ayanamsa_mode` |
| Lunar month, ritu, ayana, samvatsara | `panchanga.py` | `lunar_masa`, `ritu`, `drik_ritu`, `samvatsara` |
| Festival rules | `festival_rules.py` | `FESTIVAL_RULES`, `select_dates_for_rule`, `resolve_festivals` |
| Location and DST handling | `generate_panchanga_calendar.py` | `resolve_location`, `place_for_date`, `city_locations` |

## Web application boundary

`webapp/app.py` is the active Flask application. Existing routes provide city search, the sunrise-anchored day Panchanga JSON response, PDF generation, and ICS export. `webapp/day_panchanga.py` is the aggregation boundary: it holds `panchanga.coordinate_calculation_lock`, configures the coordinate selection, builds a DST-aware `Place`, and normalizes the engine output for consumers.

The Ghadi cosmic API is deliberately attached to this Flask application. `webapp/cosmic_api.py` contains serialization and request orchestration only. It calls `compute_day_panchanga`, `panchanga.planet_longitude`, and the existing festival rule system. It does not calculate a second Tithi, Nakshatra, Yoga, Karana, or Ayanamsha.

## Concurrency and time semantics

Swiss Ephemeris and the selected ayanamsha are process-global. Any request that changes coordinate state must hold `panchanga.coordinate_calculation_lock`. Hindu-day event times are sunrise-to-sunrise values and may be represented as hours beyond `24:00`; API clients must not silently wrap those values to the next civil date.

The engine uses astronomical year numbering and does not accept year zero. Dates from 5000 BCE through 5000 CE are supported where Swiss Ephemeris has valid data and the selected location can produce a solar anchor.

## Data contracts

Cosmic responses include an `engine` object identifying the source modules and coordinate mode, `location`, `date`, and normalized `panchanga`/`planets`/`transitions` sections. Display names come from `data/sanskrit_names.json`; calculated numbers and timestamps remain engine outputs.

The separate untracked `backend/` directory is not the active production boundary. Its approximate astronomy helpers must not be used for cosmic values unless they are replaced by adapters to the root engine.

## Extension path

1. Add new visual views under the existing Flask template/static boundary.
2. Consume `/api/cosmic/date` for the Time Machine and `/api/cosmic/current` for Today.
3. Add festival and event enrichment by extending `festival_rules.py` or adding adapters that consume its `DayRecord` values.
4. Add persistent preferences only after a storage contract is chosen; location, ayanamsha, month system, and tradition must remain explicit request inputs.
5. Validate every new view against existing CLI/PDF outputs for the same location, date, and coordinate selection.
