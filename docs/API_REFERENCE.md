# Cosmic API Reference

All responses are JSON. Named cities use the authoritative `data/cities.json` catalog. Common query parameters are `date=YYYY-MM-DD`, `city=City, CC`, and `ayanamsa=citra`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/cosmic/current` | Snapshot for today in the requested location |
| GET | `/api/cosmic/date` | Panchanga, planets, and transitions for one date |
| GET | `/api/cosmic/timeline` | Consecutive daily snapshots; `days` is capped at 31 |
| GET | `/api/cosmic/transitions` | Transition list for one date |
| GET | `/api/cosmic/planet/{planet}` | One planet from a date snapshot; English aliases are accepted |
| GET | `/api/cosmic/festivals` | Festival records for a month/year |
| GET | `/api/cosmic/festival/{festival}` | Filtered festival records |
| GET | `/api/cosmic/year/{year}` | Resolved festival records for all months |
| GET | `/api/cosmic/month/{month}` | Resolved festival records for a month; pass `year` |

Every date response includes an `engine` section identifying `panchanga.py`, coordinate mode, and ayanamsha. Numeric values are engine outputs, not frontend estimates.
