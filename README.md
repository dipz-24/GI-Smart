# GI Smart — Graph Analytics Dashboard 

A Glycemic Index (GI) nutrition tracking and meal-planning platform. Combines a Next.js web app,
a PostgreSQL database for authentication, and a Neo4j graph database for food, nutrition, and
recommendation data.

## Features

- **Authentication** — register/login via Better Auth, backed by PostgreSQL (Neon)
- **Food Database** — browse, search, and filter real foods loaded from multiple data sources into
  Neo4j; find lower-GI substitutes for any food via graph relationships
- **Weekly Meal Plan** — generated live from the graph based on each user's health goal (not a
  static template); individual meals can be shuffled for a different same-category / similar-GI
  alternative without regenerating the whole week
- **Daily Tracking** — log meal adherence and view real tracking history pulled from Neo4j
- **Dashboard** — at-a-glance stats (latest GI, calories, adherence, days logged) and today's meal
  preview, all pulled live from the graph
- **Graph Explorer** — interactive visualization of the live Neo4j graph (foods, users, meal plans,
  health goals, and how they connect), color-coded by node type

## Data Sources (Neo4j)

The food graph is built from multiple heterogeneous sources, merged into one dataset:

| Source | Format | What it provides |
|---|---|---|
| Hand-seeded core data | Cypher | Base schema: HealthConditions, HealthGoals, seed Foods, Users, MealPlans |
| Kaggle — Diabetes/Blood Pressure suitable foods | CSV | GI values, nutrition, diabetes/BP suitability flags |
| USDA FoodData Central — Foundation Foods | CSV (2 linked files) | Verified nutrition data (kcal, protein, fat, carbs, fibre) |
| Open Food Facts | CSV (sampled) | Real branded/packaged products with nutrition data |

All loads use `MERGE` (safe to re-run without creating duplicates). Foods without a source GI value
(USDA, Open Food Facts) are marked `giValue: -1` and shown as "GI N/A" in the app rather than a
misleading tier badge.

## Tech Stack

- **Frontend/Backend:** Next.js 16, React 19, Tailwind CSS
- **Auth:** Better Auth
- **Relational DB:** PostgreSQL (Neon) via Prisma — users, sessions, accounts only
- **Graph DB:** Neo4j AuraDB — foods, nutrition, meal plans, tracking, recommendations
- **Graph visualization:** react-force-graph-2d

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up PostgreSQL (Neon)
1. Go to https://neon.tech and create a free account
2. Create a new project
3. Copy the connection string

### 3. Set up Neo4j (Aura)
1. Go to https://neo4j.com/cloud/platform/aura-graph-database/ and create a free AuraDB instance
2. Download/save the credentials file it gives you (URI, username, password) — Aura only shows the
   password once
3. Load the graph data — see `data/` folder for the source CSVs and ask a teammate for the current
   load scripts if you're setting this up fresh

### 4. Configure environment
```bash
cp .env.example .env.local
```
Fill in:
```
DATABASE_URL=...
BETTER_AUTH_SECRET=...
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=xxxxx
NEO4J_PASSWORD=...
```
Note: for this project's Aura instance, `NEO4J_USERNAME` is the instance ID (not the default `neo4j`)
— double check against your Aura credentials file.

### 5. Generate Better Auth secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 6. Push database schema
```bash
npx prisma db push
```

### 7. Run development server
```bash
npm run dev
```

Deployed Link: - https://gi-smart-teal.vercel.app/

## Project Structure
```
app/
├── (auth)/              # Login & Register
├── (main)/              # Main app pages
│   ├── dashboard/        # Live stats + today's meals (Neo4j)
│   ├── foods/             # Food database + Find Alternatives (Neo4j)
│   ├── meal-plan/         # Generated weekly plan + shuffle (Neo4j)
│   ├── tracking/          # Daily log + real history (Neo4j)
│   ├── graph/              # Interactive graph explorer (Neo4j)
│   └── user/profile/
├── api/
│   ├── auth/              # Better Auth handler
│   ├── foods/              # List foods, find alternatives
│   ├── meal-plan/           # Generate plan, shuffle a single meal
│   ├── tracking/            # Tracking history
│   └── graph/                # Nodes/links for the graph explorer
components/
├── Navbar.tsx
└── ui/                    # shadcn/ui components
lib/
├── auth.ts                # Better Auth server config + Neo4j user sync hook
├── auth-client.ts
├── neo4j.ts                # Neo4j driver singleton
├── neo4j-sync.ts            # Auto-creates a Neo4j User node on registration
└── utils.ts
prisma/
└── schema.prisma           # Postgres schema (auth only — no food data here)
data/
└── *.csv                   # Source datasets loaded into Neo4j
scripts/
└── sample-off.js            # Samples the full Open Food Facts export down to a usable size
```

## Known Limitations / Next Steps
- Meal plan shuffle is client-side only — swapped meals aren't persisted back to Neo4j on refresh
- Water intake tracking exists in the UI but isn't backed by Neo4j yet
- Category matching for meal generation works best for the hand-seeded foods; USDA/Open Food Facts
  foods have less consistent categories

