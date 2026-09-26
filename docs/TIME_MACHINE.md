# Time Machine

The Time Machine route is `/time-machine`; its date and location controls call `/api/cosmic/date`. Dates are accepted in ISO form by the cosmic API, including negative astronomical years where supported by the root engine. Year zero remains invalid because Swiss Ephemeris and the existing project use astronomical year numbering without a civil year zero.

A Time Machine snapshot contains the sunrise-anchored Panchanga, location metadata, ayanamsha mode, planetary positions, and transition times. This creates one calculation path for today, birth snapshots, historical reconstruction, and future exploration.

A future Birth Cosmic Snapshot can reuse this contract by adding a saved input record and a presentation mode. It should not create a second birth-chart calculation engine.
