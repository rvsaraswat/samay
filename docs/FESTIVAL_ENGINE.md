# Festival Engine

Festival responses use `festival_rules.py`, `FESTIVAL_RULES`, `daily_records()`, and `resolve_festivals()`. Existing Drik rules are preserved. The cosmic API adapts their resolved dates to JSON through `/api/cosmic/festivals`, `/api/cosmic/festival/<festival>`, `/api/cosmic/month/<month>`, and `/api/cosmic/year/<year>`.

Festival calculations are location-aware where the upstream rule declares that requirement. A location is resolved from `data/cities.json`, including its IANA timezone, before records are generated. Festival dates must not be replaced with approximate civil-calendar formulas.

The current record is intentionally compact: name, resolved date text, marker, year, month, and location. Future detail fields such as category, tradition, explanation, and astronomical conditions should be added to the upstream rule model or a documented adapter rather than inferred in the frontend.
