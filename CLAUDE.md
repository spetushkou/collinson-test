# CLAUDE.md

Instructions for the coding agent working in this repo. It is public on purpose: the exercise asks
to see how the work was done, and this file is how I steer the agent.

## What this project is

A take-home exercise for a Senior / Lead Engineer role. The brief itself is not in the repo. In
short:

- **Build a backend service** that takes a city or town and **ranks how good the next 7 days are**
  for four activities: skiing, surfing, outdoor sightseeing, indoor sightseeing.
- **Weather data from Open-Meteo**, **persisted** rather than fetched per request. How it is
  modelled, stored and refreshed is part of the problem.
- **Stack: Node.js and GraphQL.** Storage is our call. **No front end** - the brief forbids one.
- **Focus beats volume.** A focused submission that reasons well beats an exhaustive one.
- **Graded in this order:**
  1. **How the work was done** - the reasoning, the calls made, the assumptions, the questions
     that would normally go to a product manager and the assumption taken, what was cut and why.
     Unpolished.
  2. **The service, plus a short README**: what was built, how to run it, the assumptions.
- **AI use is expected** and should be visible - see "AI use" below.

Treat every open question the brief leaves (what "good" means per activity, how a city is
resolved, how stale data may get, what happens when Open-Meteo is down) as a **product question**:
record it and the assumption taken, then proceed. Do not stall on it.

## The process trail

**Half the grade, so it is a deliverable, not a by-product.** Everything a reviewer should see of
the thinking goes into `docs/process/`:

```
file                       holds                                          written when
-------------------------  ---------------------------------------------  -------------------------
docs/process/README.md     the index, and how the work was done (tools,   once, then kept current
                             AI, the loop)
docs/process/decisions.md  dated decisions: the question, the options     the moment a call is made
                             considered, the call, why. Newest last
docs/process/questions.md  open product questions and the assumption      the moment one comes up
                             taken for each; marked when later confirmed
                             or reversed
docs/process/journal/      one file per working session: what was tried,  at the end of a session
  <YYYY-MM-DD>.md            what changed course, what was cut and why
```

- **Unpolished on purpose.** Working notes, first person, written at the moment of the decision -
  not reconstructed at the end. A wrong turn stays in, with one line on why it was wrong.
- **Product and design calls only.** Decisions about the agent's own tooling are not the exercise
  and stay out.
- **Cut scope gets a line.** "Cut X because Y" is worth more to a reviewer than X.
- **Cite only files in the repo.** A reviewer cannot open anything else.
- **GitHub issues and PRs are part of the trail.** An issue carries the problem and its acceptance
  criteria, its comments carry the rulings, and the PR carries the change.

## AI use

The process docs and the README say plainly which model was used, for what, and where its output
was overruled. Commit messages, code, PR descriptions and issue comments carry **no tool
attribution** - no `Co-Authored-By`, no "generated with".

## Stack and layout

NestJS 12, ESM (`"type": "module"`, so relative imports end in `.js`), `@nestjs/graphql` 14 with
the Apollo driver on Express 5, code-first. The schema is generated into `schema.gql` at the root
and committed. Vitest 4 for unit tests (`*.spec.ts` beside the code) and e2e tests
(`test/*.e2e-spec.ts`), oxlint (type-aware), prettier. **Pins:** TypeScript 6.x and `graphql` 16.x

- the Nest and Apollo packages do not accept the newer majors yet. Node 22 (`.nvmrc`), pnpm 10.

```
script            does
----------------  ------------------------------------------------------------
pnpm start:dev    watch mode on http://localhost:4000 (PORT overrides)
pnpm start:prod   run the build from dist/ (start, start:debug also exist)
pnpm build        compile to dist/
pnpm type-check   tsc --noEmit
pnpm lint         oxlint --type-aware - prints NOTHING when clean
pnpm format       prettier --check (format:fix writes)
pnpm test         unit tests; pnpm test:e2e for end-to-end
```

Run `type-check`, `lint`, `format` and both test suites before every push.

Layout: one Nest module per domain under `src/` (`src/health/` so far). **Storage is open** - it is
the next design call and belongs in `docs/process/decisions.md` when it is made. The service reads
its configuration from the environment; `.env_example` lists every variable.

There is **no deployed environment**. "Done" means verified against a local run: the service
started and the changed behaviour exercised with a real GraphQL request, not only unit tests.

## Edge cases this product has to answer

```
Class                    Ask
-----------------------  ---------------------------------------------------------
Ambiguous place name     "Paris" (FR or TX), "Springfield". Which one wins, and can
                         the caller tell which one they got?
Unknown / junk input     A city that does not exist, an empty string, a postcode.
Activity not possible    Surfing inland, skiing at sea level in summer. A low score,
                         or "not applicable"? (a product question - record it)
Day boundaries           Whose "next 7 days" - the city's timezone or the server's?
                         A city across the date line.
Stale / missing data     Open-Meteo down, slow, partial (a day missing a field).
                         How old may stored data be before it is not served?
Refresh concurrency      Two requests for an unseen city at once - one upstream
                         call or two? A refresh racing a read.
Many cities              Storage growth, refresh cost when every city ever asked
                         is kept fresh.
```

Open-Meteo is free and keyless but rate-limited: tests run against a local double, never against
the live API in a loop.

## Conventions

- **Tickets are GitHub issues** on this repo. Status is `open`/`closed` plus one `status:` label
  (`ready`, `in progress`, `in review`, `in testing`). The PR's `Closes #<n>` closes the issue on
  merge - nobody closes it by hand.
- **One branch, `main`** - plain GitHub Flow. Work happens on `<type>/<issue#>-<slug>`
  (`feature/42-activity-ranking-query`), squashed to one commit before review, merged by rebase.
- **Commits:** Conventional Commits with type `feature`, not `feat`; header <= 120 chars; no issue
  number in commit messages or PR titles - it lives in the branch name and the `Closes` line.
- **PR description:** `Closes #<n>`, then Summary, Screenshots (omitted when there is nothing to
  show) and Manual Testing (steps against a local run; omitted when not applicable).
- **The commit history is part of the trail too.** Small, honest commits on a branch read as
  reasoning, so keep each one an isolated change even though the branch is squashed before merge.
- **Never `git push` without explicit approval.**
- **ASCII only** in code, docs, commits and comments: `-` not en/em dashes, `->` not arrows.
- Comments only where the code cannot say it - no comments that restate the code.
