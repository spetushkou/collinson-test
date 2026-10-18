# Design: activity rankings from stored weather

Written 2026-10-18, before any product code. This is the document the plan is built from. The
product questions it rests on are in [`questions.md`](questions.md) by id (Q1, Q2, ...), each with
the assumption taken; the dated calls are in [`decisions.md`](decisions.md).

## Intent

A GraphQL service that takes a city or town and says, for each of skiing, surfing, outdoor
sightseeing and indoor sightseeing, how good each of the next 7 days will be - scored, ranked and
explained. Weather comes from Open-Meteo and is stored, so the upstream API is called when our
copy is missing or old, not on every request.

The reader is an engineer judging how the work was done. So every number the service returns
must be traceable to a rule a reader can argue with, every product question is written down with
the assumption taken, and what was cut is listed with the reason. Depth goes into the reasoning,
not the feature count.

## Goals, non-goals, anti-goals

```
goals                                   non-goals                        anti-goals (failure even if it works)
--------------------------------------  -------------------------------  ----------------------------------------
one query answers the brief end to end  a front end                      a score nobody can explain
scores carry their reasons              auth, rate limiting of our own   calling Open-Meteo on every request
place resolution the caller can verify  a background refresh job         a silent wrong Paris
Open-Meteo down != service down         hourly resolution in the API     hiding a cut instead of stating it
runs with `pnpm install && pnpm         Docker, a caching layer beyond   a test suite that hits the live API
  start:dev`, nothing else                the database
```

## Constraints

- Node.js, NestJS 12, GraphQL (`@nestjs/graphql`, Apollo, code-first) - already scaffolded.
- Storage: a SQLite file through Drizzle ORM's stable `libsql` driver (`drizzle-orm/libsql` on a
  `file:` URL). `@libsql/client` ships prebuilt binaries, so there is no build step and no service
  to start. Node's built-in `node:sqlite` was the first choice; Drizzle supports it only in its
  1.0 prerelease (checked 2026-10-18: `latest` 0.45.4 has no `node-sqlite` export), and a
  prerelease is the wrong base for a reviewer's install.
- Open-Meteo free tier: 10,000 calls a day, 5,000 an hour, 600 a minute, no key. Data is CC BY 4.0,
  so the README attributes it.
- One working day for the whole build. The cut list at the end is what that buys.
- Tests never call the live API.

## Why a SQL file and not Redis

Redis is the reflex for "cache an upstream API", and it would serve the read path fine. It loses
on the parts the brief grades:

```
the question                      SQLite file                          Redis
--------------------------------  -----------------------------------  ---------------------------------
"how you model it"                typed rows per place per day, a      a string or hash per key; the
                                    schema and migrations a reader can   model lives in the serialiser
                                    read                                 and the key naming
"how you store it"                one file, created on first start     a service a reviewer must run
                                                                         (Docker or a local install)
"how you refresh it"              fetched_at is a column: age is       TTL expiry is the only built-in
                                    queryable, stale data is still       tool, and expiry deletes - the
                                    there to serve when upstream is      stale copy we want to serve on
                                    down                                 an outage is exactly what it
                                                                         throws away
asking across days or places      SQL                                  application code
durability across restarts        yes, for free                        persistence is configuration
```

The honest case for Redis is a fleet of service instances sharing one cache under real load, and
that is not this problem. If it ever is, the storage layer is one module behind an interface, and
what moves is the module.

## The API

```graphql
type Query {
  activityRankings(city: String!, countryCode: String): ActivityRankings!
}

type ActivityRankings {
  location: Location! # what "city" resolved to - always echoed
  forecast: ForecastMeta!
  activities: [ActivityRanking!]!
}

type Location {
  name: String! # "Paris"
  admin1: String # "Ile-de-France"
  country: String!
  countryCode: String! # "FR"
  latitude: Float!
  longitude: Float!
  elevation: Float! # metres, from the geocoder
  timezone: String! # "Europe/Paris" - the days below are this zone's days
}

type ForecastMeta {
  fetchedAt: String! # ISO 8601, when the stored forecast was fetched
  ageMinutes: Int!
  stale: Boolean! # true = older than the refresh window and the refresh failed
  marineFetchedAt: String # the marine data's own fetch time; null when none was ever stored
  source: String! # "open-meteo"
}

enum Activity {
  SKIING
  SURFING
  OUTDOOR_SIGHTSEEING
  INDOOR_SIGHTSEEING
}

type ActivityRanking {
  activity: Activity!
  applicable: Boolean! # false = we have no data to judge it (see Q3)
  reason: String # why not applicable
  days: [DayScore!]! # up to 7, sorted by rank; fewer only on a stale answer; empty when not applicable
}

type DayScore {
  date: String! # "2026-10-19", the location's local day
  rank: Int! # 1 = best day for this activity
  score: Int! # 0..100
  factors: [Factor!]! # the rules that produced the score
}

type Factor {
  name: String! # "fresh snow"
  value: String! # "12 cm"
  points: Int! # +18, -15 ...
}
```

Errors are GraphQL errors with a `code` in `extensions`:

```
code                    when
----------------------  ---------------------------------------------------------------
BAD_USER_INPUT          city shorter than 2 characters, or countryCode not 2 letters
PLACE_NOT_FOUND         the geocoder returned no result for the name
UPSTREAM_UNAVAILABLE    Open-Meteo failed and nothing is stored for this place
```

## Resolving a place (Q2)

Open-Meteo's geocoder (`/v1/search?name=..&count=1[&countryCode=..]`) ranks by population, so
"Paris" is Paris, France; "Paris" with `countryCode: "US"` is Paris, Texas. The first result wins.
The resolved place is always echoed in `location`, so a caller can see which Paris they got and
re-ask with a country code. An unknown name returns HTTP 200 with no `results` key (verified
2026-10-18; the docs say 400) - that is `PLACE_NOT_FOUND`.

Lookups are stored: the normalised query (`lower(trim(city))` plus the country code) maps to a
place id, with a 30-day shelf life. Places do not move.

## Weather data

Two upstream calls per place per refresh, both with `timezone=auto` so days are the place's own
days and `forecast_days=7`:

```
call      endpoint                             variables
--------  -----------------------------------  ----------------------------------------------------
forecast  api.open-meteo.com/v1/forecast       daily: temperature_2m_max, temperature_2m_min,
                                                 snowfall_sum, precipitation_sum,
                                                 precipitation_probability_max, weather_code,
                                                 sunshine_duration, daylight_duration,
                                                 wind_speed_10m_max, uv_index_max
                                               hourly: snow_depth (folded to the day's maximum;
                                                 there is no daily snow depth)
marine    marine-api.open-meteo.com/v1/marine  daily: wave_height_max, wave_period_max
```

Verified behaviour that the design leans on: for an inland point the marine call returns HTTP 200
with `null` in every value (Paris, Madrid, Chamonix, Denver); a coastal point returns numbers
(Lisbon). So "no marine data" is read from the values, never guessed from geography.

Each call has a 5-second timeout and no retry. The two calls succeed or fail independently and are
stored independently: a failed marine call with a good forecast call is still a successful refresh
of the forecast, and the previously stored wave values (if any) are kept rather than overwritten.
A marine call that succeeds with `null` values is a success - it is the answer "no sea here".

Any single value can be `null` in an Open-Meteo answer (a day missing one variable). Every weather
column is nullable and the scoring treats a null as "no data" (see Scoring).

## Storage model

```
table              columns                                                   notes
-----------------  --------------------------------------------------------  -------------------------
places             id (geocoder id, pk), name, admin1, country,              one row per resolved
                     country_code, latitude, longitude, elevation,             place
                     timezone, population, fetched_at
place_lookups      query (pk part), country_code (pk part, '' when none),    the cache of "what the
                     place_id -> places, fetched_at                            caller typed" -> place
daily_forecasts    place_id (pk part) -> places, date (pk part, 'YYYY-MM-DD'  one row per place per
                     local), fetched_at, temp_max_c, temp_min_c,               local day; a forecast
                     snowfall_cm, snow_depth_max_cm, precipitation_mm,          refresh upserts all 7
                     precipitation_probability_pct, weather_code,               in one transaction
                     sunshine_s, daylight_s, wind_max_kmh, uv_index_max,
                     marine_fetched_at (nullable), wave_height_max_m,
                     wave_period_max_s
```

Every weather column is nullable; the keys and the `fetched_at` columns are not.
`marine_fetched_at` is null until a marine call has succeeded for that day, and is set even when
the values it stored are null - that is how "no sea here" (fetched, null) is told apart from
"marine source down" (never fetched).

Typed rows rather than a JSON blob, because the rows are exactly what the scoring reads and a
reader can query them. Migrations are generated by drizzle-kit and applied at boot, so a reviewer
runs nothing but `pnpm start:dev`. The database location comes from `DB_URL`
(default `file:./data/weather.sqlite`, gitignored).

## Refresh policy (Q4)

```
on a request for a place:
  window = the place's next 7 local days (today in its timezone, plus 6)
  rows   = the stored rows for those days
  if all 7 exist and the oldest fetched_at is within FORECAST_TTL_MINUTES (default 60)
      -> serve, stale=false
  else fetch upstream (single-flight per place in this process)
    forecast ok   -> upsert the 7 forecast rows in one transaction
    marine ok     -> write the wave columns and marine_fetched_at (same transaction)
    marine failed -> leave the wave columns as they were
    then serve, stale=false
    forecast failed
      -> rows in the window: serve them, stale=true, ageMinutes from the oldest, log a warning
      -> no rows in the window: UPSTREAM_UNAVAILABLE
```

Sixty minutes because Open-Meteo's forecast models update about hourly and the use case is planning
days ahead, not minute-level weather. No hard cap on age: stored data with its age stated beats an
error for a planning question. A stale answer carries whatever rows are left in the window - after
local midnight that is six, a week later none, and none is treated as nothing stored.

### Tracking staleness in data that keeps changing

A forecast is not a fact that goes out of date once; tomorrow's forecast is rewritten every few
hours, and it is a different number each time. The storage therefore never versions or appends -
it holds exactly one row per place per day, and a refresh **replaces** that row (upsert on
`(place_id, date)`). Three things make the copy trustworthy:

```
mechanism                 answers                                   how
------------------------  ----------------------------------------  --------------------------------
fetched_at on every row   "how old is this?"                        a column, so it is queryable
                                                                      and returned as ageMinutes
the refresh window        "is it old enough to re-ask?"             oldest fetched_at in the
                                                                      window older than the TTL
the 7-day window          "is it even about the right days?"        a missing local day forces a
                                                                      refresh whatever the TTL says
```

Invalidation is time-based, never event-based: nothing tells us a forecast changed, so the only
honest signal is age. And expiry never deletes - the stale copy is the fallback when Open-Meteo is
down, which is why TTL-style eviction (a cache's default) would be the wrong tool here. Rows that
fall out of the window are left behind; cleanup is cut and the table is bounded by places x days
ever fetched.

## Scoring (Q1, Q6, Q7)

A score is the sum of a small set of named factors, clamped to 0..100, one set per activity. Each
factor maps a measured value to points and a label. The numbers below are the starting point and
are expected to be tuned; they live in one file per activity so the rules read as a table.

Rules that hold for every table: ranges are contiguous and cover every value (a range with no
opinion scores 0 with a label such as "overcast"); the lower bound of a range is inclusive, the
upper exclusive; **every factor is listed on every day**, 0 points included, so the explanation is
complete; a factor whose input is null scores 0 with the value "no data".

```
SKIING                                 value                      points
-------------------------------------  -------------------------  -------
snow base (snow_depth_max_cm)          <5 / 5-20 / 20-50 / >=50   0 "no base" / +10 / +25 / +40
fresh snow (snowfall_cm)               <2 / 2-10 / 10-20 / >=20   0 / +10 / +18 / +25
temperature (temp_max_c)               <-15 / -15..-10 / -10..2   -10 "bitter" / +5 "cold" / +15
                                         / 2..6 / >=6               / +5 / -10 "slush"
wind (wind_max_kmh)                    <20 / 20-40 / 40-60 / >=60 +10 / 0 / -10 / -25 "lifts close"
sky (weather_code)                     0-2 / 45,48 / 95-99 /      +10 "clear" / -15 "fog" / -10
                                         any other                  "storm" / 0 "overcast or precip"

SURFING                                value                      points
-------------------------------------  -------------------------  -------
wave height (wave_height_max_m)        <0.5 / 0.5-1 / 1-2.5 /     0 "flat" / +20 / +40 / +25 /
                                         2.5-4 / >=4                -10 "dangerous"
wave period (wave_period_max_s)        <7 / 7-10 / >=10           +5 / +15 / +25
wind (wind_max_kmh)                    <15 / 15-30 / 30-50 / >=50 +15 / +5 / -10 / -25
air temperature (temp_max_c)           <10 / 10-18 / >=18         -5 / +5 / +10
storms (weather_code)                  95-99 / any other          -30 / 0 "no storms"

OUTDOOR SIGHTSEEING                    value                      points
-------------------------------------  -------------------------  -------
rain chance (precipitation_prob_pct)   <20 / 20-50 / 50-80 / >=80 +30 / +15 / -5 / -20
rain amount (precipitation_mm)         <10 / >=10                 0 / -10
temperature (temp_max_c)               <0 / 0-8 / 8-15 / 15-26 /  -15 / 0 "cold" / +10 / +25 /
                                         26-32 / 32-35 / >=35       +10 / 0 "hot" / -15
wind (wind_max_kmh)                    <20 / 20-40 / >=40         +15 / +5 / -15
sunshine (sunshine_s / daylight_s)     <0.3 / 0.3-0.6 / >=0.6     0 "overcast" / +8 / +15
sky (weather_code)                     95-99 / 45,48 / any other  -20 "storm" / -10 "fog" / 0
uv (uv_index_max)                      <8 / >=8                   0 / -5 "bring shade"

INDOOR SIGHTSEEING                     value                      points
-------------------------------------  -------------------------  -------
baseline                               always                     +50 "museums do not mind weather"
rain chance (precipitation_prob_pct)   <30 / 30-60 / >=60         0 / +10 / +25
temperature (temp_max_c)               <5 or >=30 / otherwise     +15 / 0
wind (wind_max_kmh)                    >=40 / otherwise           +10 / 0
a day to be outside                    sunshine ratio >= 0.6 and  -20 / 0
                                         temp 15-26 / otherwise
```

Days are ranked **within each activity** by score descending, ties broken by date ascending -
that is the reading of "ranks how good the next 7 days will be for each of these activities".
Activities are returned in the enum's order, and their scores are not comparable with each other
(indoor starts from a baseline of 50; surfing can reach 90). A `weather_code` is the WMO code
Open-Meteo returns; 0-2 clear to partly cloudy, 45/48 fog, 95-99 thunderstorms.

## Applicability (Q3)

`applicable: false` means "we have no data to judge this", never "conditions are bad":

- surfing is not applicable when every day's `wave_height_max_m` is null. The reason says which
  case it is: "no wave data for this location" when the marine call succeeded with nulls (inland),
  "wave data unavailable" when no marine call has ever succeeded for these days;
- skiing is not applicable only when every day lacks both `snow_depth_max_cm` and `snowfall_cm`
  (the same "no data" rule). Skiing at sea level in July has data, scores 0 on every day with
  the reason "no base", and stays applicable: the data exists and says no;
- a single day with a null input is scored, with that factor marked "no data" (Scoring).

Geocoding returns a town's centre, which for a surf town is a land cell. The marine API's default
`cell_selection=sea` picks the nearest sea cell for it (Biarritz: 7 km away, Lisbon: 6 km), so
coastal towns get wave data; the limit is stated rather than worked around (Q9).

## Testing

- Scoring is pure functions over a day's row: table-driven unit tests, one per factor boundary,
  plus one whole-day example per activity.
- The Open-Meteo client is tested against a local double: fixtures captured once from real
  responses (Paris inland, Lisbon coastal, an unknown name, a day with a null value). Unit tests
  hand the client a fake `fetch`; the end-to-end tests run a tiny `node:http` server that serves
  the same fixtures, reached through the configured base URLs - no new dependency, no network.
- End to end: the query against the double and a temporary database file - the fresh path, the
  refresh path, the stale path (upstream fails after a stored forecast), `PLACE_NOT_FOUND`, and an
  inland city with surfing not applicable.
- The upstream base URLs come from configuration, so the double is wired by environment, not by
  patching modules.

## Configuration

```
variable               default                 meaning
---------------------  ----------------------  ------------------------------------------
PORT                   4000
NODE_ENV               development             production keeps the schema in memory
DB_URL                 file:./data/weather.sqlite  libsql URL; the file is created on first start
FORECAST_TTL_MINUTES   60                      refresh window
UPSTREAM_TIMEOUT_MS    5000                    per upstream call
OPEN_METEO_FORECAST_URL   https://api.open-meteo.com          overridden by tests
OPEN_METEO_MARINE_URL     https://marine-api.open-meteo.com
OPEN_METEO_GEOCODING_URL  https://geocoding-api.open-meteo.com
```

All validated at boot; a bad value is a crash with a message, not a silent default.

## Observability

One structured log line per upstream call (endpoint, place id, milliseconds, status) and one per
refresh decision (fresh / refreshed / stale / failed), through Nest's logger. Nothing else - no
metrics, no tracing.

## CI

A GitHub Actions workflow on every push and pull request: `pnpm install --frozen-lockfile`, then
lint, type-check, format check, unit tests, e2e tests, build, on the Node version in `.nvmrc`.

## Cut, and why

```
cut                                 why
----------------------------------  --------------------------------------------------------------
background refresh job              one day; refresh-on-read keeps the stored data honest for the
                                      places anyone asks about, and a job needs a second code
                                      path and its own tests
retry on upstream failure           the stale path already covers the common case; a retry adds
                                      latency to every failure
stale-while-revalidate              serving the old week at once and refreshing in the background
                                      would hide upstream latency from the caller; the
                                      refresh-on-read here blocks for up to two 5-second calls
                                      once an hour per place, which a planning query can afford,
                                      and it keeps one code path instead of two
cleanup of old forecast rows        bounded by places x 7, grows slowly; a one-line job later
auth, rate limiting of our own      not asked for; the free tier is 10,000 calls a day and our
                                      storage keeps us far under it
hourly resolution in the API        the brief asks about days
Docker, Postgres                    a reviewer should need nothing but Node and pnpm
input by coordinates                the brief says city or town
```

## Left to the builder

Module layout inside `src/`; the exact Drizzle schema and migration files; how the hourly snow
depth is folded; the config loader (a plain typed object is enough); the GraphQL error plumbing;
the shape of the log lines; fixture capture; the single-flight implementation.
