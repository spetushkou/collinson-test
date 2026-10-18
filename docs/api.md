# Using the API

Requests to copy and paste, with what each one should return. Every answer below came from a
local run on 2026-10-18 against the live Open-Meteo API, so the weather numbers will differ on
your day. The shape will not. The reference for every type and field is
[`schema.gql`](../schema.gql), and this page does not repeat it.

## Where it is

```
what               where
-----------------  --------------------------------------------------------------
GraphQL            POST http://localhost:4000/graphql, JSON body {query, variables}
GraphiQL           http://localhost:4000/graphql in a browser - not in production
liveness           GET http://localhost:4000/health -> 200 {"status":"ok"}
the log            /tmp/collinson-api.log, rewritten on every start
```

Start it with `pnpm start:dev`; `PORT` moves it. Under `pnpm start:prod` GraphiQL and schema
introspection are off, so you send requests with `curl` there.

## The query

There is one query, `activityRankings(city, countryCode)`. The full selection is in
[`api-query.graphql`](api-query.graphql). In GraphiQL, paste it and set the variables to
`{"city": "Lisbon"}`. From a shell at the repo root, `jq` builds the body from the file:

```bash
rank() {
  jq -n --rawfile q docs/api-query.graphql --argjson v "$1" '{query: $q, variables: $v}' |
    curl -s localhost:4000/graphql -H 'content-type: application/json' --data @-
}

rank '{"city": "Lisbon"}' | jq .
rank '{"city": "Paris", "countryCode": "US"}' | jq '.data.activityRankings.location'
```

Ask only for the fields you need - `{ activityRankings(city: "Lisbon") { activities { activity
days { date score } } } }` is a valid query too.

How to read an answer:

- `location` is the place the name resolved to. Check it is the one you meant.
- `activities` always has four entries, in the order SKIING, SURFING, OUTDOOR_SIGHTSEEING,
  INDOOR_SIGHTSEEING. Each has up to seven `days`, best first: `rank` 1 is the best day.
- A `score` is 0 to 100, the sum of its `factors` clamped to that range. Scores compare days
  within one activity, not one activity with another.
- `forecast.stale` is true when the refresh failed and stored weather is served instead.
  `ageMinutes` says how old it is.

## Cases worth trying

```
send                                   expect
-------------------------------------  --------------------------------------------------
{"city": "Lisbon"}                     SURFING applicable, 7 days. The best one on the day:
                                         2026-10-23, score 90 - wave height 1.2 m (+40),
                                         wave period 11.1 s (+25), wind 11.5 km/h (+15),
                                         air temperature 23.9 C (+10)
{"city": "Paris"}                      Paris, FR. SURFING applicable=false, reason "no
                                         wave data for this location", days []
{"city": "Paris", "countryCode": "US"} Paris, Texas, timezone America/Chicago
{"city": "Queenstown"}                 Queenstown, ZA - the most populous one wins
{"city": "Queenstown",                 Queenstown, NZ. Its days start on 2026-10-19:
 "countryCode": "NZ"}                    the 7 days are the place's own local days, and it
                                         was already the 19th there
{"city": "Chamonix"}                   SKIING applicable, but every day scores 0 in
                                         October: factor "skiable snow" = "none - nothing
                                         else counts", -100. Snow depth is read at the
                                         town's coordinates, not on the slopes
{"city": "75001"}                      Paris, FR - the geocoder knows postcodes
the same city again within the hour    the same fetchedAt, and the log says
                                         decision=fresh - no call to Open-Meteo
```

Skiing is the hard one to show off in October. The skiing factors and every other rule table
are in [`process/design.md`](process/design.md).

## Errors

An error the caller can act on has a code in `errors[0].extensions.code`, and `data` is null:

```
send                                    code                   message
--------------------------------------  ---------------------  ----------------------------
{"city": "xqzvplace"}                   PLACE_NOT_FOUND        no place called "xqzvplace"
{"city": "P"} or {"city": ""}           BAD_USER_INPUT         city must be at least 2
                                                                 characters
{"city": "Paris", "countryCode": "FRA"} BAD_USER_INPUT         countryCode must be a 2-letter
                                                                 ISO code, such as "FR"
a new city while the forecast is down   UPSTREAM_UNAVAILABLE   the weather service is
                                                                 unavailable and nothing is
                                                                 stored for this place
a new city while geocoding is down      UPSTREAM_UNAVAILABLE   Open-Meteo geocoding: <what
                                                                 failed>
api-query.graphql, no city variable     BAD_USER_INPUT         Variable "$city" of required
                                                                 type "String!" was not
                                                                 provided. (Apollo's)
no city argument in an inline query     GRAPHQL_VALIDATION_    Apollo's own message
                                          FAILED
```

The service's own errors - the first five rows - come back with HTTP 200. Apollo's two at the
bottom are rejected before the query runs, with HTTP 400.

Anything else is a bug: outside production it comes back with Apollo's
`INTERNAL_SERVER_ERROR` and a stack trace, and in production as "Internal server error" with
the detail in the log.

## Open-Meteo down, by hand

Point the forecast URL at a port nothing listens on, and shorten the refresh window so a city
you already asked for is due for a refresh:

```bash
FORECAST_TTL_MINUTES=1 OPEN_METEO_FORECAST_URL=http://127.0.0.1:9 pnpm start:dev
```

- A city stored more than a minute ago comes back with its stored days, `"stale": true`, and
  `ageMinutes` saying how old they are. The log says `decision=stale rows=7`.
- A city never asked for before gets `UPSTREAM_UNAVAILABLE`.

The end-to-end test `test/rankings.e2e-spec.ts` checks both cases against a local stand-in for
Open-Meteo, with no calls to the live API.
