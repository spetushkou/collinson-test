# Decisions

Newest last. Each entry: the question, the options I weighed, the call, and why.

```
### YYYY-MM-DD - <the question>

Options:  ...
Call:     ...
Why:      ...
```

### 2026-10-18 - framework and GraphQL layer

Options:  NestJS or plain Express/Fastify with a GraphQL server; Apollo or Mercurius as the
          Nest GraphQL driver; code-first or schema-first.
Call:     NestJS 12, `@nestjs/graphql` with the Apollo driver on Express, code-first. The
          generated `schema.gql` is committed so the API can be read without running anything.
Why:      Nest gives modules and dependency injection, which I want once storage, the
          Open-Meteo client and the scoring live side by side. Apollo on Express is the most
          documented Nest path. Code-first keeps one source of truth for a small API. Raw speed
          is not the bottleneck here - the data is stored and the payloads are small.

### 2026-10-18 - test runner and linter: keep the Nest 12 defaults

Options:  Jest + ESLint, or what `nest new` generates.
Call:     Keep the generated Vitest 4 + oxlint, ESM (`"type": "module"`).
Why:      I first picked Jest because the model told me it was Nest's default. Checking the
          generated project showed Nest 12 ships Vitest and oxlint, already working with
          decorator metadata. Swapping them out would be setup work against the framework's own
          default, so I reversed the call.

### 2026-10-18 - version pins

Call:     TypeScript 6.x, `graphql` 16.x.
Why:      `@nestjs/graphql` 14 accepts TypeScript up to 6 (7 is out but unsupported), and
          `@apollo/server` 5 accepts `graphql` ^16.11 only (17 is out but unsupported).

### 2026-10-18 - storage and features are deferred

Call:     The scaffold has no database and no domain code - only `GET /health` and a `ping`
          query, because code-first GraphQL will not build a schema without a Query type.
Why:      Storage is the first real design call of the exercise and deserves its own entry,
          not a default buried in a scaffold.
