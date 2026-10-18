# collinson-test

A backend service that takes a city or town and ranks how good the next 7 days will be for
skiing, surfing, outdoor sightseeing and indoor sightseeing, using weather data from
[Open-Meteo](https://open-meteo.com/) that the service stores rather than fetching on every
request.

How I worked - the decisions, the open questions and what I cut - is in
[`docs/process/`](docs/process/README.md). That is the part I would read first.

## What is built so far

The service is at the scaffold stage: NestJS 12 with GraphQL (`@nestjs/graphql`, Apollo driver on
Express, code-first). The ranking, the Open-Meteo client and storage are not built yet - storage
is the next design call.

```
endpoint             what it does
-------------------  ----------------------------------------------------------
GET  /health         liveness, returns {"status":"ok"}
POST /graphql        GraphQL. One placeholder query, `ping`, returns "pong"
```

The GraphQL schema is generated from the code into [`schema.gql`](schema.gql), which is committed
so the API can be read without running anything.

## How to run it

Needs Node.js 20 or newer (built on 22) and pnpm 10.

```bash
pnpm install
pnpm start:dev          # http://localhost:4000, restarts on change
```

Then:

```bash
curl -s localhost:4000/health
curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{ ping }"}'
```

Opening http://localhost:4000/graphql in a browser gives GraphiQL for trying queries.
The port can be changed with `PORT`.

```
command            does
-----------------  ------------------------------------------------------
pnpm test          unit tests (Vitest)
pnpm test:e2e      end-to-end tests against the running Nest app
pnpm lint          oxlint, type-aware
pnpm type-check    tsc --noEmit
pnpm build         compile to dist/; `pnpm start:prod` runs it
```

## Assumptions

Product assumptions - what makes a day good for each activity, how a place name is resolved,
how stale stored weather may get - are recorded as I make them in
[`docs/process/questions.md`](docs/process/questions.md), each with the question I would have
asked a product manager. None are settled yet.

Technical ones so far:

- **TypeScript 6 and `graphql` 16, not the latest majors.** `@nestjs/graphql` 14 and
  `@apollo/server` 5 do not accept TypeScript 7 or `graphql` 17 yet.
- **No front end**, as the brief asks. GraphiQL is only a way to send queries.
- **Runs locally only.** There is no deployment.
