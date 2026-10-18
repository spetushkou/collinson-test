# Open questions

Questions I would normally check with a product manager, and the assumption I went with so the
work could continue. Each one is marked when it is later confirmed or reversed. The design in
[`design.md`](design.md) cites them by id.

### Q1 - What makes a day "good" for each activity?

- **Assumption:** a small rule table per activity (snow base and fresh snow for skiing; wave height
  and period for surfing; rain chance, temperature band and sunshine for outdoor sightseeing),
  each rule adding or removing points, summed and clamped to 0..100. The rules are the product
  opinion, written where they can be argued with, and the numbers are a first pass.
- **Why:** the brief gives no definition, and a weighted rule set is the simplest thing that is
  both explainable and tunable.
- **Status:** open. Changed during the build: a day with no snow on the ground and little falling
  scores 0 for skiing whatever the weather - before that rule a calm, clear July day scored 10.

### Q2 - Which "Paris"?

- **Assumption:** the most populous match wins; an optional `countryCode` narrows it; the response
  always echoes the resolved place so the caller can tell.
- **Why:** it is what a person typing "Paris" means most of the time, and the echo makes the
  other cases visible instead of silently wrong.
- **Status:** open

### Q3 - Is "surfing in Madrid" a low score or not applicable?

- **Assumption:** not applicable - but only when there is no data to judge (the marine API returns
  nulls inland). Skiing with no snow is a score of 0 with the reason "no base", because the data
  exists and says no.
- **Why:** mixing "bad" and "unknown" into one number would make the ranking lie in one of the two
  directions.
- **Status:** open

### Q4 - How old may stored weather be before we stop serving it?

- **Assumption:** refresh when older than 60 minutes; if the refresh fails, serve what we have and
  say how old it is (`stale: true`, `ageMinutes`). No hard cap.
- **Why:** the question is about planning days ahead, where an hour-old forecast is as good as a
  fresh one, and an answer with its age stated beats an error.
- **Status:** open

### Q5 - Whose "next 7 days"?

- **Assumption:** the place's own local days, starting today in its timezone.
- **Why:** someone asking about Sydney wants Sydney's days; Open-Meteo's `timezone=auto` gives
  exactly that.
- **Status:** open

### Q6 - What does "good for indoor sightseeing" mean?

- **Assumption:** a day is better for indoor sightseeing the worse it is outside: a baseline that
  never drops to zero (museums do not mind the weather), raised by rain, cold, heat and wind, and
  lowered on a day that is clearly better spent outdoors.
- **Why:** ranking the same 7 days for indoor and outdoor only makes sense if the two answer
  different questions; this reading makes them complementary.
- **Status:** open

### Q7 - What scale, and how are ties ranked?

- **Assumption:** integers 0..100; ties broken by the earlier date.
- **Why:** a familiar scale, and "sooner" is a reasonable tiebreak for a trip planner.
- **Status:** open

### Q8 - Metric or imperial?

- **Assumption:** metric only, units named in each factor's label ("12 cm", "45 km/h").
- **Why:** one unit system keeps the rules readable; a locale layer is cheap to add later.
- **Status:** open

### Q9 - A surf town's centre is on land; is "not applicable" acceptable there?

- **Assumption:** yes. The marine API's default cell selection prefers sea cells, so Biarritz and
  Lisbon return waves from the nearest sea cell a few kilometres off. A town further from its
  break than that would get "no wave data for this location", and the answer says so.
- **Why:** a nearest-coast search is more upstream calls and new logic for a case I have not seen;
  the limit is stated instead.
- **Status:** open

### Q10 - What does the API return when fewer than 7 days are usable?

- **Assumption:** only on a stale answer (the refresh failed) can `days` have fewer than 7
  entries: whatever stored days fall inside the window. Once none do, that counts as nothing
  stored and the request fails with `UPSTREAM_UNAVAILABLE`.
- **Why:** a partial week with its age stated is still useful for planning; inventing the missing
  days is not.
- **Status:** open
