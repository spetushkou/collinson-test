# collinson-test

A GraphQL service that takes a city or town and ranks how good each of the next 7 days will be
for skiing, surfing, outdoor sightseeing and indoor sightseeing. Every score comes with the
factors that produced it. The weather comes from [Open-Meteo](https://open-meteo.com/) and is
stored in a SQLite file, so the upstream API is called when our copy is missing or more than an
hour old, not on every request.

**How I worked - the design, the decisions, the open questions and what I cut - is in
[`docs/process/`](docs/process/README.md). That is the part I would read first.** The commits on
`main` are the steps in the order they happened, each with its reason, and every change came
through a GitHub issue and a pull request.

## How to run it

Needs Node.js 22 (`.nvmrc`; `nvm use` picks it up) and pnpm 10. Nothing else - the database is
a file created on first start.

```bash
pnpm install
pnpm start:dev          # http://localhost:4000; also logs to /tmp/collinson-api.log
```

Open http://localhost:4000/graphql for GraphiQL, or send a query with `curl`:

```bash
curl -s localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ activityRankings(city: \"Lisbon\") { location { name country timezone } forecast { stale ageMinutes } activities { activity applicable reason days { date rank score factors { name value points } } } } }"}'
```

Lisbon on 2026-10-18, trimmed to the best surf day:

```json
{
  "location": {
    "name": "Lisbon",
    "country": "Portugal",
    "timezone": "Europe/Lisbon"
  },
  "forecast": { "stale": false, "ageMinutes": 0 },
  "activities": [
    {
      "activity": "SURFING",
      "applicable": true,
      "reason": null,
      "days": [
        {
          "date": "2026-10-23",
          "rank": 1,
          "score": 90,
          "factors": [
            { "name": "wave height", "value": "1.2 m", "points": 40 },
            { "name": "wave period", "value": "11.1 s", "points": 25 },
            { "name": "wind", "value": "14.9 km/h", "points": 15 },
            { "name": "air temperature", "value": "24 C", "points": 10 },
            { "name": "storms", "value": "no storms (code 3)", "points": 0 }
          ]
        }
      ]
    }
  ]
}
```

- `countryCode` picks among places with the same name: `city: "Paris", countryCode: "US"` is
  Paris, Texas. The resolved place is always in `location`, so you can see which one you got.
- Errors carry a code in `extensions.code`: `BAD_USER_INPUT`, `PLACE_NOT_FOUND`,
  `UPSTREAM_UNAVAILABLE`.
- `GET /health` is the liveness check. The full schema is in [`schema.gql`](schema.gql).

```
command            does
-----------------  ------------------------------------------------------
pnpm test          unit tests (Vitest)
pnpm test:e2e      the query end to end, against a local stand-in for
                     Open-Meteo - no test calls the live API
pnpm lint          oxlint, type-aware
pnpm type-check    tsc --noEmit
pnpm build         compile to dist/; `pnpm start:prod` runs it
```

Configuration is optional; `.env_example` lists every variable with its default (port, database
file, refresh window, upstream timeout, Open-Meteo URLs). A bad value stops the service at boot
with the key named.

## What I built

- **One query**, `activityRankings(city, countryCode)`: the resolved place, the forecast's age and
  whether it is stale, and the four activities in a fixed order, each with its seven days ranked
  best first.
- **Scores you can argue with.** Each score (0-100) is a sum of named factors from a small rule
  table per activity - snow base and fresh snow for skiing, wave height and period for surfing,
  rain chance, temperature, wind and sunshine for sightseeing. Indoor sightseeing is better the
  worse it is outside. The tables are in [`docs/process/design.md`](docs/process/design.md).
- **"Not applicable" means no data, never bad conditions.** Surfing inland has no wave data and is
  marked not applicable with the reason; skiing with no snow has data, scores 0 and says why.
- **Stored weather with an honest age.** One row per place per local day, replaced on refresh.
  The stored week is served for 60 minutes; after that it is refreshed. If Open-Meteo is down,
  the stored days are served with `stale: true` and their age rather than an error.
  Concurrent requests for the same place share one upstream call.

## Assumptions

The ones that shape the answers, with the question I would have asked a product manager, are in
[`docs/process/questions.md`](docs/process/questions.md). The main ones:

- "Good" for each activity is the rule table in the design - a first pass, meant to be tuned.
- "Paris" is the most populous Paris; a country code picks another.
- The next 7 days are the place's own local days, starting today in its timezone.
- Weather up to an hour old is fresh enough for planning; older stored data beats no answer.
- Metric units only.

**What I cut**, each with its reason in the design: a background refresh job, retries,
stale-while-revalidate, auth and rate limiting, hourly detail, Docker and Postgres, and input by
coordinates.

## Data

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
