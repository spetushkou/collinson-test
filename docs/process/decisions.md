# Decisions

Newest last. Each entry: the question, the options I weighed, the call, and why.

```
### YYYY-MM-DD - <the question>

- **Options:** ...
- **Call:** ...
- **Why:** ...
```

### 2026-10-18 - framework and GraphQL layer

- **Options:** NestJS or plain Express/Fastify with a GraphQL server; Apollo or Mercurius as the Nest GraphQL driver; code-first or schema-first.
- **Call:** NestJS 12, `@nestjs/graphql` with the Apollo driver on Express, code-first. The generated `schema.gql` is committed so the API can be read without running anything.
- **Why:** Nest gives modules and dependency injection, which I want once storage, the Open-Meteo client and the scoring live side by side. Apollo on Express is the most documented Nest path. Code-first keeps one source of truth for a small API. Raw speed is not the bottleneck here - the data is stored and the payloads are small.

### 2026-10-18 - test runner and linter: keep the Nest 12 defaults

- **Options:** Jest + ESLint, or what `nest new` generates.
- **Call:** Keep the generated Vitest 4 + oxlint, ESM (`"type": "module"`).
- **Why:** I first picked Jest because the model told me it was Nest's default. Checking the generated project showed Nest 12 ships Vitest and oxlint, already working with decorator metadata. Swapping them out would be setup work against the framework's own default, so I reversed the call.

### 2026-10-18 - version pins

- **Call:** TypeScript 6.x, `graphql` 16.x.
- **Why:** `@nestjs/graphql` 14 accepts TypeScript up to 6 (7 is out but unsupported), and `@apollo/server` 5 accepts `graphql` ^16.11 only (17 is out but unsupported).

### 2026-10-18 - storage and features are deferred

- **Call:** The scaffold has no database and no domain code - only `GET /health` and a `ping` query, because code-first GraphQL will not build a schema without a Query type.
- **Why:** Storage is the first real design call of the exercise and deserves its own entry, not a default buried in a scaffold.

### 2026-10-18 - what the submission should show

- **Options:** depth in scope judgement; depth in production discipline; depth in architecture.
- **Call:** scope judgement - a small service whose decisions are visible and defended, with the cut list and the product assumptions written down. One working day.
- **Why:** the brief says a focused submission that reasons well beats an exhaustive one, and grades how the work was done ahead of the service.

### 2026-10-18 - storage: a SQLite file through Drizzle on node:sqlite

- **Options:** SQLite file; Postgres in Docker; in-memory with a JSON snapshot.
- **Call:** SQLite via `drizzle-orm/node-sqlite` - Node 22's built-in driver, so no native build and nothing to start.
- **Why:** a reviewer should need only Node and pnpm. Typed rows and real migrations still answer "how you model it". Postgres buys nothing for seven days of a handful of cities.

### 2026-10-18 - scores carry their reasons

- **Call:** every day's score lists the factors that produced it (`"fresh snow", "12 cm", +18`).
- **Why:** the scoring model is the product opinion; a bare number hides it.

### 2026-10-18 - the cut list

- **Call:** no background refresh job, no retry, no row cleanup, no auth, no rate limiting of our own, no hourly resolution, no Docker, no input by coordinates. A small CI workflow stays in.
- **Why:** one day. Each cut and its reason is in `design.md`.

### 2026-10-18 - the design before the plan

- **Call:** `design.md` is written and reviewed before any ticket is cut, after reading the Open-Meteo docs and probing the live API (geocoding ranks by population; an unknown name is a 200 with no results; the marine API answers inland points with nulls, not an error).
- **Why:** the two surprises above would each have cost a wrong turn mid-build.

### 2026-10-18 - a SQL file, not Redis

- **Options:** Redis as a cache of the upstream answers; a SQLite file with typed rows.
- **Call:** SQLite. The full comparison is in `design.md`, "Why a SQL file and not Redis".
- **Why:** the brief grades how the data is modelled, stored and refreshed. Typed rows and a `fetched_at` column answer that in a way a reader can inspect; Redis puts the model in the key naming, needs a running service, and its one refresh tool - TTL expiry - deletes exactly the stale copy we want to serve when Open-Meteo is down.

### 2026-10-18 - wrong turn: Node's built-in SQLite is not in stable Drizzle

- **Call:** the driver is Drizzle's `libsql` on a `file:` URL, not `node:sqlite`.
- **Why:** I chose `node:sqlite` because it needs no native dependency and the documentation showed a Drizzle driver for it. The driver exists only in Drizzle's 1.0 prerelease; the stable release has none. A prerelease is the wrong base for a reviewer's install. libsql ships prebuilt binaries, so the "no build step" property survives; checked with a scratch install.
