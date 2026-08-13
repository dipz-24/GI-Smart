# README — Dipti

Individual contribution summary for the GI Smart project. Covers Neo4j work,
feature integration, API development, and production deployment 

**Live app:** https://gi-smart-teal.vercel.app

## What I built

### 1. Neo4j Graph Database — Setup & Connection
- Set up a Neo4j AuraDB instance and connected the Next.js app to it via a shared driver
  singleton (`lib/neo4j.ts`), used across every API route I built
- Configured the driver with `disableLosslessIntegers: true` so numeric properties return as
  plain JS numbers instead of Neo4j's internal integer representation

### 2. Graph Data Model I Designed and Loaded
**6 node labels:** `Food`, `HealthCondition`, `HealthGoal`, `MealPlan`, `TrackingDay`, `User`

**8 relationship types:** `HAS_GOAL`, `TARGETS`, `SAFE_FOR`, `FOLLOWS`, `INCLUDES`, `LOGGED`,
`CONSUMED`, `SIMILAR_GI_TO`

```
(User)-[:HAS_GOAL]->(HealthGoal)-[:TARGETS]->(HealthCondition)
(Food)-[:SAFE_FOR]->(HealthCondition)
(User)-[:FOLLOWS]->(MealPlan)-[:INCLUDES]->(Food)
(User)-[:LOGGED]->(TrackingDay)
(Food)-[:SIMILAR_GI_TO]->(Food)
```

### 3. Multi-Source Data Loading
Loaded real data from 3 external sources, plus hand-seeded core data, all merged into one graph:

| Source | Format | Records | Provides |
|---|---|---|---|
| Hand-seeded | Cypher | — | Base schema, starter goals/conditions/plans |
| USDA FoodData Central | CSV (2 linked files) | 378 | Verified nutrition (kcal, protein, fat, carbs, fibre) |
| Kaggle — Diabetes/BP | CSV | 254 | GI values, diabetes/BP suitability flags |
| Open Food Facts | CSV (sampled) | 2,823 | Real branded/packaged products |

- Built a GitHub-hosted CSV pipeline — loaded data directly into Neo4j via `LOAD CSV` against raw
  GitHub URLs, making the load process reproducible for the whole team
- Sampled the full 12GB+ Open Food Facts export down to ~3,000 usable rows with a Node.js script
  (`scripts/sample-off.js`)
- Used `MERGE` throughout every load script — never `CREATE` — so loads are idempotent and safe
  to re-run
- Demonstrated both relationship-creation strategies: `HAS_GOAL`/`FOLLOWS`/`INCLUDES`/`LOGGED`/
  `CONSUMED`/`TARGETS` created inline during load; `SAFE_FOR`/`SIMILAR_GI_TO` derived in a
  separate post-load pass by comparing properties (`giValue`, `category`) across already-loaded
  nodes
- Verified `MERGE` correctness directly: across 3,465 `Food` nodes, 47 share a display name but
  zero share a `foodId`

**Data quality note:** foods from USDA and Open Food Facts have no source GI value, so they're
marked `giValue: -1` and shown as "GI N/A" in the app. Both `SAFE_FOR` and `SIMILAR_GI_TO`
explicitly filter out `giValue: -1` nodes so GI-unknown foods never contaminate recommendations.

### 4. Live Features Built on the Graph
- **Foods page** — rebuilt to pull the full food list live from Neo4j instead of static/hardcoded
  data; added GI tier display with color coding, search, category filtering, and correct
  handling of GI-unknown foods
- **Find Alternatives** — substitution feature querying `SIMILAR_GI_TO` live to suggest lower-GI
  swaps for any food
- **Meal Plan page** — a weekly plan generated dynamically per user based on their `HealthGoal`
  (not a static template), plus a per-meal shuffle feature that swaps one meal for a same-category
  or `SIMILAR_GI_TO` alternative without touching the rest of the week
- **Tracking page** — real logged history pulled from `TrackingDay`
- **Dashboard** — live stats (latest GI, calories, adherence, days logged) and today's meal
  preview, all sourced from the same live APIs
- **Graph Explorer** — an interactive, force-directed visualization of the live graph
  (`react-force-graph-2d`), color-coded by node type

### 5. API Routes I Built
`/api/foods`, `/api/foods/alternatives`, `/api/meal-plan`, `/api/meal-plan/shuffle`,
`/api/tracking`, `/api/graph` — full documentation for each in `API_DOCUMENTATION.md`.

### 6. Auth ↔ Graph Integration
Added a Better Auth hook (`lib/neo4j-sync.ts`) that automatically creates a matching Neo4j `User`
node — linked to a `HealthGoal` and starter `MealPlan` — the moment someone registers, so
personalization works without manual setup per user.

### 7. Production Deployment
Deployed the app to Vercel via a personal GitHub repo, and diagnosed and fixed four real
production issues:
- **Prisma client built for the wrong OS** — added Linux binary targets alongside Windows, and
  made `prisma generate` run as part of the build script so the client always regenerates fresh
- **Vercel Deployment Protection blocking every request** (including API routes) behind a
  Vercel-auth wall — disabled it on the production deployment
- **Better Auth rejecting the live domain** with `INVALID_ORIGIN` — added the production domain
  to `trustedOrigins`


## Known Open Items in My Own Work

- **Meal plan shuffle is client-side only** — swapped meals aren't persisted back to Neo4j on
  refresh


## AI Usage Disclosure
I used Claude as a coding assistant while building this — mainly for writing and
debugging Cypher scripts, putting together Next.js API routes and pages, and working through a
long list of deployment headaches (Prisma acting up on a different OS, environment variables not
matching between local and production, Vercel blocking requests behind its own auth wall, Better
Auth rejecting the live domain). It was basically like having someone to pair-program with and
bounce errors off of — I made the calls on what data sources to use, how the app should work, and
tested everything myself to make sure it actually ran. The AI helped me move faster and get
unstuck a lot faster than googling every error one by one, but the project itself is mine.
