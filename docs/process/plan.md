# Activity Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo each task is one GitHub issue run through `/x-ticket-run`; the epic is #4 and each task heading carries its issue.

**Goal:** One GraphQL query that resolves a city, stores a 7-day forecast from Open-Meteo in SQLite, and returns scored, ranked, explained days for skiing, surfing, outdoor and indoor sightseeing.

**Architecture:** NestJS modules by domain - `config`, `database`, `open-meteo`, `places`, `weather`, `scoring`, `rankings`. The upstream client takes `fetch` by injection; the database is Drizzle on libsql with migrations applied at boot; scoring is pure functions over a stored day row; the resolver composes the three services and maps `AppError` codes to GraphQL error extensions.

**Tech Stack:** NestJS 12 (ESM, code-first GraphQL on Apollo/Express), `drizzle-orm/libsql` + `@libsql/client` + `drizzle-kit`, Vitest 4, oxlint, Node 22 `fetch`.

**Spec:** [`design.md`](design.md). Product assumptions: [`questions.md`](questions.md).

## Global Constraints

- Node `>=22.12` (`engines`), pnpm 10; packages younger than 7 days are refused by `.npmrc`.
- ESM: relative imports end in `.js`; `"type": "module"`.
- Commit type `feature`, not `feat`; no issue number in commit messages; the branch is `<type>/<issue#>-<slug>`; commits are not squashed.
- Tests never call the live API. Fixtures are captured once by a script and committed.
- Every weather column nullable; keys and `fetched_at` not.
- Scores are integers 0..100; every factor listed on every day; null input -> `"no data"`, 0 points.
- Config is validated at boot; a bad value throws with the key named.
- No tool attribution in code, commits or PRs; the process docs say how AI was used.
- ASCII only in code, docs and messages.

## Review Focus

1. `city` with surrounding whitespace or odd casing (`"  pArIs "`) must hit the same stored lookup as `"paris"` - test in Task 5.
2. `countryCode` in lowercase (`"fr"`) must behave as `"FR"`; three letters is `BAD_USER_INPUT` - tests in Task 5 and Task 8.
3. Open-Meteo answers HTTP 200 with `{"error": true, "reason": "..."}` for bad parameters; that is an upstream failure, not data - test in Task 4.
4. Two concurrent requests for an unseen place must produce one upstream fetch - test in Task 6.
5. A place west of UTC late in the server's UTC day: the window starts on the place's local today, not the server's - test in Task 6.

---

### Task 1 (#5): CI workflow, Node floor, design docs

**Files:**

- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (`packageManager`), `.gitignore` (add `data/`)
- Commit (already written, uncommitted): `docs/process/design.md`, `docs/process/plan.md`, `docs/process/questions.md`, `docs/process/decisions.md`

**Interfaces:**

- Produces: a green check on every push and pull request; the design and this plan on `main`.

- [ ] **Step 1: Write `.github/workflows/ci.yml`** - trigger `push` and `pull_request`; `actions/checkout@v4`; `pnpm/action-setup@v4` (version from `packageManager` - add `"packageManager": "pnpm@10.33.4"` to `package.json`); `actions/setup-node@v4` with `node-version-file: .nvmrc` and `cache: pnpm`; then `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm type-check`, `pnpm format`, `pnpm ignore:check`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, one step each.
- [ ] **Step 2: Gitignore `data/`** (the SQLite file's directory) and re-sync the ignore lists. The Node floor stays `>=22.12`: the 22.13 floor was for `node:sqlite`, which the design dropped for libsql.
- [ ] **Step 3: Verify locally** - run the same eight commands in order; expected: every one exits 0.
- [ ] **Step 4: Commit the docs and the workflow separately** - `docs: design and plan for the activity rankings` (the four process files), then `ci: run the gates on every push`.
- [ ] **Step 5: After the PR opens, confirm the workflow ran** - `gh run list --limit 1 --json conclusion` on the branch; expected `success`.

### Task 2 (#6): Configuration

**Files:**

- Create: `src/config/config.ts`, `src/config/config.module.ts`, `src/config/config.spec.ts`
- Modify: `.env_example` (every variable from the design's Configuration table), `src/main.ts` (listen on `config.port`)

**Interfaces:**

- Produces:

  ```ts
  export interface AppConfig {
    port: number;
    nodeEnv: 'development' | 'production' | 'test';
    dbUrl: string; // DB_URL, default 'file:./data/weather.sqlite'
    forecastTtlMinutes: number; // FORECAST_TTL_MINUTES, default 60
    upstreamTimeoutMs: number; // UPSTREAM_TIMEOUT_MS, default 5000
    openMeteo: { forecastUrl: string; marineUrl: string; geocodingUrl: string };
  }
  export class ConfigError extends Error {} // message names every bad key
  export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig;
  export const APP_CONFIG = Symbol('APP_CONFIG'); // Nest token for the AppConfig value
  export class ConfigModule {} // @Global, provides APP_CONFIG from loadConfig()
  ```

- [ ] **Step 1: Write the failing tests** in `config.spec.ts`: defaults when `env` is `{}`; `PORT=4001` parses to 4001; `FORECAST_TTL_MINUTES=abc` throws `ConfigError` whose message contains `FORECAST_TTL_MINUTES`; `NODE_ENV=staging` throws; `OPEN_METEO_FORECAST_URL=not a url` throws; two bad keys appear in one message.
- [ ] **Step 2: Run `pnpm test -- config`** - expected: FAIL, module not found.
- [ ] **Step 3: Implement `loadConfig`** - integers via `Number.parseInt` with a finite-and-positive check, URLs via `new URL()`, collect every failure before throwing. No library.
- [ ] **Step 4: Implement `ConfigModule`** and use `APP_CONFIG` in `main.ts` for the port.
- [ ] **Step 5: Run `pnpm test -- config` and `pnpm test:e2e`** - expected: PASS.
- [ ] **Step 6: Commit** - `feature: validate configuration at boot`.

### Task 3 (#7): Database schema, migrations, boot-time migrate

**Files:**

- Create: `drizzle.config.ts`, `src/database/schema.ts`, `src/database/database.ts`, `src/database/database.module.ts`, `src/database/database.spec.ts`, `drizzle/` (generated migration)
- Modify: `package.json` (deps `drizzle-orm`, `@libsql/client`; dev `drizzle-kit`; script `db:generate`: `drizzle-kit generate`)

**Interfaces:**

- Consumes: `APP_CONFIG` (`dbUrl`).
- Produces:

  ```ts
  // schema.ts - exactly the design's Storage model
  export const places = sqliteTable('places', { id: integer().primaryKey(), name: text().notNull(), admin1: text(), country: text().notNull(), countryCode: text('country_code').notNull(), latitude: real().notNull(), longitude: real().notNull(), elevation: real().notNull(), timezone: text().notNull(), population: integer(), fetchedAt: text('fetched_at').notNull() });
  export const placeLookups = sqliteTable('place_lookups', { query: text().notNull(), countryCode: text('country_code').notNull(), placeId: integer('place_id').notNull().references(() => places.id), fetchedAt: text('fetched_at').notNull() }, (t) => [primaryKey({ columns: [t.query, t.countryCode] })]);
  export const dailyForecasts = sqliteTable('daily_forecasts', { placeId, date: text().notNull(), fetchedAt: text('fetched_at').notNull(), tempMaxC: real('temp_max_c'), tempMinC, snowfallCm, snowDepthMaxCm, precipitationMm, precipitationProbabilityPct: integer(...), weatherCode: integer(...), sunshineS: real(...), daylightS, windMaxKmh, uvIndexMax, marineFetchedAt: text('marine_fetched_at'), waveHeightMaxM: real(...), wavePeriodMaxS: real(...) }, (t) => [primaryKey({ columns: [t.placeId, t.date] })]);
  export type PlaceRow = typeof places.$inferSelect;
  export type DailyForecastRow = typeof dailyForecasts.$inferSelect;
  // database.ts
  export type Db = LibSQLDatabase<typeof schema>;
  export const DRIZZLE = Symbol('DRIZZLE');
  export function createDb(url: string): Db;                 // drizzle-orm/libsql
  export function runMigrations(db: Db): Promise<void>;      // drizzle-orm/libsql/migrator, folder 'drizzle'
  export class DatabaseModule {}                             // @Global; provides DRIZZLE; onModuleInit -> runMigrations
  ```

  Timestamps are ISO 8601 strings (`text`), always UTC.

- [ ] **Step 1: Write the failing test** in `database.spec.ts`: `createDb('file:<tmpdir>/t.sqlite')`, `runMigrations`, then `select name from sqlite_master where type='table'` contains `places`, `place_lookups`, `daily_forecasts`; a second `runMigrations` on the same file does not throw.
- [ ] **Step 2: Run `pnpm test -- database`** - expected: FAIL.
- [ ] **Step 3: Add the dependencies, write `schema.ts` and `drizzle.config.ts`** (`dialect: 'sqlite'`, `schema: './src/database/schema.ts'`, `out: './drizzle'`), run `pnpm db:generate`, commit the generated SQL.
- [ ] **Step 4: Implement `database.ts` and `DatabaseModule`**; `mkdir -p` the `dbUrl` directory before opening when the URL is `file:`.
- [ ] **Step 5: Run `pnpm test -- database`, then `pnpm start:dev` once** - expected: PASS; `data/weather.sqlite` appears; `/health` is 200.
- [ ] **Step 6: Commit** - `feature: store places and daily forecasts in sqlite`.

### Task 4 (#8): Open-Meteo client

**Files:**

- Create: `src/open-meteo/open-meteo.client.ts`, `src/open-meteo/types.ts`, `src/open-meteo/open-meteo.module.ts`, `src/open-meteo/open-meteo.client.spec.ts`, `scripts/capture-fixtures.mjs`, `test/fixtures/{geocode-paris,geocode-paris-us,geocode-unknown,forecast-paris,forecast-lisbon,marine-paris,marine-lisbon,forecast-with-null}.json`

**Interfaces:**

- Consumes: `APP_CONFIG` (`openMeteo.*`, `upstreamTimeoutMs`).
- Produces:

  ```ts
  export type FetchFn = typeof fetch;
  export const FETCH = Symbol('FETCH');                     // default provider: globalThis.fetch
  export interface GeocodedPlace { id: number; name: string; admin1: string | null; country: string; countryCode: string; latitude: number; longitude: number; elevation: number; timezone: string; population: number | null }
  export interface DailyForecast { date: string; tempMaxC: number | null; tempMinC: number | null; snowfallCm: number | null; snowDepthMaxCm: number | null; precipitationMm: number | null; precipitationProbabilityPct: number | null; weatherCode: number | null; sunshineS: number | null; daylightS: number | null; windMaxKmh: number | null; uvIndexMax: number | null }
  export interface DailyMarine { date: string; waveHeightMaxM: number | null; wavePeriodMaxS: number | null }
  export class UpstreamError extends Error { constructor(readonly endpoint: 'geocoding' | 'forecast' | 'marine', message: string) }
  export class OpenMeteoClient {
    geocode(name: string, countryCode?: string): Promise<GeocodedPlace | null>;  // null = no results
    forecast(latitude: number, longitude: number): Promise<DailyForecast[]>;      // 7 days, local
    marine(latitude: number, longitude: number): Promise<DailyMarine[]>;
  }
  ```

  `snowDepthMaxCm` = max of the day's 24 hourly `snow_depth` values (metres x 100), nulls ignored, all-null -> null. Query strings are exactly the design's variable lists plus `timezone=auto&forecast_days=7`; geocoding adds `count=1&language=en`.

- [ ] **Step 1: Write `scripts/capture-fixtures.mjs`** - fetches the eight real responses above (Paris 48.85,2.35; Lisbon 38.72,-9.14; `name=xqzvplace`; `forecast-with-null` is `forecast-paris` with one `temperature_2m_max` entry set to `null` by the script) into `test/fixtures/`. Run it once; commit the files. It is the only code that touches the live API.
- [ ] **Step 2: Write the failing tests** with a fake `FetchFn` that returns a fixture by URL substring and records the URL: `geocode('Paris')` returns Paris FR with `timezone 'Europe/Paris'`; `geocode('Paris', 'US')` sends `countryCode=US`; `geocode('xqzvplace')` returns `null`; `forecast()` returns 7 `DailyForecast` with `snowDepthMaxCm` folded; the null fixture yields `tempMaxC: null` on that day; `marine()` for Paris returns 7 days of `null` waves, Lisbon numbers; HTTP 500 throws `UpstreamError` with `endpoint 'forecast'`; body `{"error":true,"reason":"x"}` with HTTP 200 throws `UpstreamError` whose message contains `x`; a `fetch` that never resolves rejects within `upstreamTimeoutMs` (use `AbortSignal.timeout`).
- [ ] **Step 3: Run `pnpm test -- open-meteo`** - expected: FAIL.
- [ ] **Step 4: Implement the client and module.**
- [ ] **Step 5: Run `pnpm test -- open-meteo`** - expected: PASS.
- [ ] **Step 6: Commit** - `feature: open-meteo client with captured fixtures`.

### Task 5 (#9): Places - resolve and remember

**Files:**

- Create: `src/places/places.service.ts`, `src/places/places.module.ts`, `src/places/places.service.spec.ts`, `src/common/errors.ts`

**Interfaces:**

- Consumes: `DRIZZLE`, `OpenMeteoClient`, `CLOCK` (defined here, used by Task 6 too).
- Produces:

  ```ts
  // common/errors.ts
  export type ErrorCode = 'BAD_USER_INPUT' | 'PLACE_NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  export class AppError extends Error { constructor(readonly code: ErrorCode, message: string) }
  // places
  export const CLOCK = Symbol('CLOCK'); export type Clock = () => Date;   // default: () => new Date()
  export function normaliseQuery(city: string): string;                    // trim, collapse spaces, lowercase
  export class PlacesService { resolve(city: string, countryCode?: string): Promise<PlaceRow> }
  ```

  `resolve`: validate (`city` < 2 chars after trim or `countryCode` not `/^[A-Za-z]{2}$/` -> `AppError('BAD_USER_INPUT')`), upper-case the code, look up `place_lookups` by (`normaliseQuery(city)`, code or `''`) with `fetched_at` within 30 days -> return the place; else geocode; `null` -> `AppError('PLACE_NOT_FOUND')`; else upsert `places` and `place_lookups` in one transaction. A geocoding `UpstreamError` becomes `AppError('UPSTREAM_UNAVAILABLE')`.

- [ ] **Step 1: Write the failing tests** with a temp database and a fake client: first `resolve('Paris')` geocodes once and stores; `resolve('  pArIs ')` returns the same row with zero further geocode calls; `resolve('Paris', 'us')` geocodes with `'US'` and stores a second lookup; `'P'` throws `BAD_USER_INPUT`; `'xqzvplace'` throws `PLACE_NOT_FOUND`; a lookup older than 30 days (clock advanced) geocodes again.
- [ ] **Step 2: Run `pnpm test -- places`** - expected: FAIL.
- [ ] **Step 3: Implement `errors.ts`, `PlacesService`, `PlacesModule`** (provides `CLOCK`).
- [ ] **Step 4: Run `pnpm test -- places`** - expected: PASS.
- [ ] **Step 5: Commit** - `feature: resolve a city to a stored place`.

### Task 6 (#10): Weather - the week, the refresh policy, staleness

**Files:**

- Create: `src/weather/weather.repository.ts`, `src/weather/weather.service.ts`, `src/weather/window.ts`, `src/weather/weather.module.ts`, `src/weather/window.spec.ts`, `src/weather/weather.service.spec.ts`

**Interfaces:**

- Consumes: `DRIZZLE`, `OpenMeteoClient`, `CLOCK`, `APP_CONFIG` (`forecastTtlMinutes`), `PlaceRow`, `DailyForecastRow`.
- Produces:

  ```ts
  export function localWindow(timezone: string, now: Date): string[]; // 7 'YYYY-MM-DD', local today first
  export interface WeatherWeek {
    days: DailyForecastRow[];
    fetchedAt: string;
    ageMinutes: number;
    stale: boolean;
    marineFetchedAt: string | null;
  }
  export class WeatherRepository {
    getWindow(placeId: number, dates: string[]): Promise<DailyForecastRow[]>;
    upsertForecast(
      placeId: number,
      days: DailyForecast[],
      fetchedAt: string,
    ): Promise<void>; // one transaction; leaves wave columns untouched
    upsertMarine(
      placeId: number,
      days: DailyMarine[],
      fetchedAt: string,
    ): Promise<void>; // only rows that exist
  }
  export class WeatherService {
    getWeek(place: PlaceRow): Promise<WeatherWeek>;
  } // the design's refresh policy, verbatim
  ```

  `localWindow`: today = `Intl.DateTimeFormat('en-CA', { timeZone }).format(now)`; the next six by adding 86400 s to a UTC-noon `Date` of that day. Single-flight: a `Map<number, Promise<WeatherWeek>>` in the service, entry removed on settle. Freshness: all 7 dates present and the oldest `fetchedAt` within the TTL. Log one line per upstream call and per decision (`fresh` / `refreshed` / `stale` / `failed`) with Nest's `Logger`.

- [ ] **Step 1: Write `window.spec.ts`**: `localWindow('Pacific/Honolulu', new Date('2026-10-19T05:00:00Z'))` starts `'2026-10-18'`; `localWindow('Pacific/Auckland', same)` starts `'2026-10-19'`; seven consecutive dates; a DST change day in `Europe/Paris` still yields seven distinct dates.
- [ ] **Step 2: Write `weather.service.spec.ts`** with a temp database, a fake client (counts calls, can be set to fail per endpoint) and a settable clock: empty store -> one forecast and one marine call, 7 rows, `stale false`, `ageMinutes 0`; second call within 60 min -> zero upstream calls; clock +61 min -> refetch; forecast fails with rows stored -> `stale true`, `ageMinutes 61`, rows served; forecast fails with nothing stored -> `AppError('UPSTREAM_UNAVAILABLE')`; marine fails after a stored success -> wave columns unchanged, `marineFetchedAt` unchanged; marine returns nulls -> `marineFetchedAt` set, waves null; clock +1 day -> only 6 of the window's 7 dates are stored, so a refetch is forced; with the forecast failing, the stale answer carries 6 days; `Promise.all([getWeek(p), getWeek(p)])` on an empty store -> one forecast call.
- [ ] **Step 3: Run `pnpm test -- weather`** - expected: FAIL.
- [ ] **Step 4: Implement `window.ts`, the repository, the service, the module.**
- [ ] **Step 5: Run `pnpm test -- weather`** - expected: PASS.
- [ ] **Step 6: Commit** - `feature: store and refresh the week's forecast per place`.

### Task 7 (#11): Scoring - four rule tables, ranking, applicability

**Files:**

- Create: `src/scoring/types.ts`, `src/scoring/factors.ts`, `src/scoring/skiing.ts`, `src/scoring/surfing.ts`, `src/scoring/outdoor.ts`, `src/scoring/indoor.ts`, `src/scoring/rank.ts`, `src/scoring/activities.ts`, one `*.spec.ts` beside each

**Interfaces:**

- Consumes: `DailyForecastRow` (only its weather columns; the task defines `DayInput = Pick<DailyForecastRow, ...weather columns>` so it never touches the database).
- Produces:

  ```ts
  export type Activity =
    'SKIING' | 'SURFING' | 'OUTDOOR_SIGHTSEEING' | 'INDOOR_SIGHTSEEING';
  export interface Factor {
    name: string;
    value: string;
    points: number;
  }
  export interface DayScore {
    date: string;
    rank: number;
    score: number;
    factors: Factor[];
  }
  export interface Applicability {
    applicable: boolean;
    reason?: string;
  }
  // factors.ts - the one helper every table uses
  export function band(
    name: string,
    value: number | null,
    unit: string,
    bands: Array<{ below: number; points: number; label?: string }>,
    last: { points: number; label?: string },
  ): Factor;
  //   bands are tried in order: value < below -> that band (lower bound inclusive, upper exclusive); value null -> { value: 'no data', points: 0 }
  export function scoreSkiingDay(d: DayInput): Factor[]; // and surfing, outdoor, indoor - the design's tables, one factor per row, always all factors
  export function skiingApplicability(days: DayInput[]): Applicability; // false when every day has null snowDepthMaxCm AND null snowfallCm
  export function surfingApplicability(
    days: DayInput[],
    marineFetched: boolean,
  ): Applicability; // false when every waveHeightMaxM null; reason 'no wave data for this location' if marineFetched else 'wave data unavailable'
  export function rankDays(
    days: Array<{ date: string; factors: Factor[] }>,
  ): DayScore[]; // score = clamp(sum, 0, 100); rank by score desc, date asc; output sorted by rank
  export const ACTIVITIES: ReadonlyArray<{
    activity: Activity;
    scoreDay: (d: DayInput) => Factor[];
    applicability: (days: DayInput[], marineFetched: boolean) => Applicability;
  }>; // enum order
  ```

- [ ] **Step 1: Write `factors.spec.ts`**: lower bound inclusive / upper exclusive at a boundary; null -> `'no data'`, 0; the label falls back to the formatted value with unit (`'12 cm'`).
- [ ] **Step 2: Write one spec per activity**, table-driven over the design's rows: one case per band of every factor (the value just inside each bound), plus one whole-day example asserting the full `Factor[]` and its sum: skiing powder day (depth 60, fresh 25, -4 C, wind 10, code 1) = 100 after clamp; surfing Lisbon-like day (1.5 m, 11 s, wind 12, 20 C, code 2) = 90; outdoor perfect day (prob 10, 0 mm, 22 C, wind 10, sunshine 0.8, code 1, uv 5) = 85; indoor rainy cold day (prob 90, 2 C, wind 50, sunshine 0.1) = 100 after clamp. Applicability: inland nulls vs never-fetched reasons; skiing all-null vs one day with data.
- [ ] **Step 3: Write `rank.spec.ts`**: clamp above 100 and below 0; ties by earlier date; ranks 1..n contiguous; output order equals rank order.
- [ ] **Step 4: Run `pnpm test -- scoring`** - expected: FAIL.
- [ ] **Step 5: Implement the eight files.** Each activity file is the table from the design, written as `band(...)` calls in the design's row order.
- [ ] **Step 6: Run `pnpm test -- scoring`** - expected: PASS.
- [ ] **Step 7: Commit** - `feature: score and rank days per activity`.

### Task 8 (#12): The GraphQL query, errors, end to end

**Files:**

- Create: `src/rankings/rankings.types.ts`, `src/rankings/rankings.service.ts`, `src/rankings/rankings.resolver.ts`, `src/rankings/rankings.module.ts`, `src/rankings/rankings.service.spec.ts`, `test/fixture-server.ts`, `test/rankings.e2e-spec.ts`
- Modify: `src/app.module.ts` (import the modules; `formatError` or a filter mapping `AppError` -> `extensions.code`), `src/health/health.resolver.ts` (remove `ping` - a real query exists now), `test/app.e2e-spec.ts` (drop the ping test), `schema.gql` (regenerated)

**Interfaces:**

- Consumes: `PlacesService.resolve`, `WeatherService.getWeek`, `ACTIVITIES`, `rankDays`, `AppError`.
- Produces: the design's GraphQL types verbatim as code-first classes (`@ObjectType`, `registerEnumType(Activity)`), and

  ```ts
  export class RankingsService {
    rank(city: string, countryCode?: string): Promise<ActivityRankings>;
  }
  // test/fixture-server.ts
  export function startFixtureServer(opts?: {
    fail?: Set<'geocoding' | 'forecast' | 'marine'>;
  }): Promise<{ baseUrl: string; close(): Promise<void>; calls: string[] }>;
  //   a node:http server routing /v1/search, /v1/forecast, /v1/marine to the Task 4 fixtures by query (name=, latitude=); fail -> 503
  ```

  `ForecastMeta.fetchedAt`/`marineFetchedAt` are the stored ISO strings; `ageMinutes` from `WeatherWeek`. Errors: `GraphQLError(message, { extensions: { code } })`; anything else -> `INTERNAL_SERVER_ERROR` with the message hidden in production.

- [ ] **Step 1: Write `rankings.service.spec.ts`** with fake places and weather services: the four activities in enum order; `days` sorted by rank; surfing `applicable false` with the inland reason when all waves null; `forecast.stale` and `ageMinutes` passed through.
- [ ] **Step 2: Write `test/fixture-server.ts` and `rankings.e2e-spec.ts`**: boot the app with `DB_URL=file:<tmp>` and the three base URLs pointing at the fixture server; query `{ activityRankings(city: "Paris") { location { name countryCode timezone } forecast { stale ageMinutes } activities { activity applicable reason days { date rank score factors { name value points } } } } }` -> Paris FR, `stale false`, skiing/outdoor/indoor applicable with 7 days each, surfing not applicable; a second query -> `calls` grew by 0; `city: "Lisbon"` -> surfing applicable; `city: "xqzvplace"` -> error `extensions.code PLACE_NOT_FOUND`; `city: "P"` -> `BAD_USER_INPUT`; `countryCode: "FRA"` -> `BAD_USER_INPUT`; a fresh database with the fixture server set to fail `forecast` -> `UPSTREAM_UNAVAILABLE`; `GET /health` still 200.
- [ ] **Step 3: Run `pnpm test -- rankings` and `pnpm test:e2e`** - expected: FAIL.
- [ ] **Step 4: Implement the types, service, resolver, module and the error mapping; regenerate `schema.gql`** (`pnpm start:dev` once, or `pnpm build`).
- [ ] **Step 5: Run `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm type-check`** - expected: all PASS; `git diff schema.gql` shows the new types and no `ping`.
- [ ] **Step 6: Run it for real once** - `pnpm start:dev`, then the Paris query with `curl` against the live API; expected: a 200 with four activities and `stale: false`; the log shows two upstream calls, then zero on the second query. Quote the response in the PR.
- [ ] **Step 7: Commit** - `feature: activityRankings query` and, separately, `refactor: drop the ping placeholder`.

### Task 9 (#13): README, attribution, process trail

**Files:**

- Modify: `README.md` ("What is built", the query example from Task 8 Step 6, the configuration table, "Weather data by Open-Meteo.com, CC BY 4.0"), `docs/process/questions.md` (mark any assumption the build confirmed or reversed), `docs/process/journal/<date>.md`

- [ ] **Step 1: Rewrite the README's "What is built so far" and "How to run it"** against the running service; keep every command verified by running it.
- [ ] **Step 2: Add the attribution line** and the cut list's one-paragraph summary pointing at `design.md`.
- [ ] **Step 3: `pnpm format`** - expected: exit 0.
- [ ] **Step 4: Commit** - `docs: readme for the activity rankings service`.

---

## Self-review notes

- Spec coverage: API (8), place resolution (5), weather data and marine independence (4, 6), storage model (3), refresh and staleness (6), scoring tables and ranking (7), applicability (7, 8), testing (4, 6, 8), configuration (2), observability (6), CI (1), attribution (9). The cut list needs no task.
- Interfaces: `DailyForecast`/`DailyMarine` (4) feed `WeatherRepository` (6); `DailyForecastRow` (3) feeds `DayInput` (7) and `WeatherWeek` (6); `AppError` (5) is thrown by 5, 6 and mapped in 8; `CLOCK` defined in 5, used in 6.
- Deviation from the design, deliberate: the test double is a `node:http` fixture server, not undici's `MockAgent` - no dependency, same `fetch` path.
