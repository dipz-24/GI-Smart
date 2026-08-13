# API Documentation — Neo4j / Graph Module

Endpoints covering the Big Data 2 (Neo4j) module: food data, meal plan generation, tracking
history, and graph visualization. All endpoints are Next.js Route Handlers under `app/api/`.

---

## `GET /api/foods`

**Purpose:** Returns the full list of foods loaded in Neo4j, for the Food Database page.

**Authentication:** None required (public read).

**Request:** No parameters.

**Response `200`:**
```json
{
  "foods": [
    {
      "foodId": "USDA-123456",
      "name": "Brown Rice, cooked",
      "category": "Grains",
      "gi": 68,
      "tier": "medium",
      "kcal": 123,
      "carbs": 25.6,
      "protein": 2.7,
      "fat": 0.9
    }
  ]
}
```
`tier` is computed server-side from `gi`: `"low"` (≤55), `"medium"` (56–69), `"high"` (≥70), or
`"unknown"` (gi < 0, meaning the source dataset had no GI value).

**Response `500`:** `{ "error": "Failed to fetch foods" }` — Neo4j connection or query failure.

---

## `GET /api/foods/alternatives`

**Purpose:** Finds lower-GI substitute foods for a given food, via the `SIMILAR_GI_TO`
relationship. Powers the "Find Alternatives" button on the Foods page.

**Authentication:** None required.

**Request params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Food name to find alternatives for (fuzzy-matched) |

**Response `200`:**
```json
{
  "matchedFood": "White Rice, cooked",
  "matchedGI": 73,
  "alternatives": [
    { "name": "Brown Rice, cooked", "giValue": 68, "kcal": 123, "category": "Grains", "giDifference": 5 }
  ]
}
```

**Response `400`:** Missing `name` query param.
**Response `500`:** Neo4j query failure.

---

## `GET /api/meal-plan`

**Purpose:** Returns a 7-day meal plan. If the requesting user has a matching `User` node in
Neo4j (linked by email), the plan is generated dynamically from foods matching their
`HealthGoal`'s GI ceiling. Otherwise falls back to a sample plan.

**Authentication:** None enforced at the route level currently — relies on the caller passing
their own session email. *(Note: this should be hardened to read the session server-side rather
than trusting a client-supplied email — flag for review.)*

**Request params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `email` | string | no | User's email, used to look up their Neo4j `User` node |

**Response `200`:**
```json
{
  "summary": "Generated from your WeightLoss goal - foods with GI at or below 60 (avg GI: 42).",
  "days": [
    { "day": "Monday", "meals": { "Breakfast": { "foods": ["Oats, rolled"], "gi": 55, "kcal": 389 } } }
  ],
  "matchedByEmail": true,
  "source": "generated",
  "targetGIMax": 60
}
```

**Response `500`:** Neo4j query failure.

---

## `GET /api/meal-plan/shuffle`

**Purpose:** Finds one replacement food for a single meal slot — same category or
`SIMILAR_GI_TO`-linked, under the goal's GI ceiling. Powers the shuffle icon on each meal card.

**Authentication:** None required.

**Request params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `food` | string | yes | Current food name to replace |
| `maxGI` | number | no | GI ceiling to filter candidates (default 70) |

**Response `200`:**
```json
{ "found": true, "name": "Lentils, cooked", "gi": 32, "kcal": 116 }
```
or `{ "found": false }` if no valid replacement exists.

**Response `400`:** Missing `food` query param.
**Response `500`:** Neo4j query failure.

**Note:** This swap is client-side only — the result is not written back to Neo4j, so a page
refresh reverts to the originally generated plan.

---

## `GET /api/tracking`

**Purpose:** Returns a user's tracking history (up to 10 most recent days). Falls back to a
sample user's history if no matching Neo4j `User` is found.

**Authentication:** Same caveat as `/api/meal-plan` — email passed by the client, not read from
a verified server-side session.

**Request params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `email` | string | no | User's email, used to look up their Neo4j `User` node |

**Response `200`:**
```json
{
  "days": [
    { "trackId": "TD-U1-D1", "date": "2024-01-15", "gi": 47, "kcal": 1750, "adherence": 0.9, "met": "yes" }
  ],
  "matchedByEmail": true,
  "userId": "U-001"
}
```
`met` is derived from `adherence`: `"yes"` (≥0.85), `"partial"` (≥0.7), `"no"` (below 0.7).

**Response `500`:** Neo4j query failure.

---

## `GET /api/graph`

**Purpose:** Returns nodes and relationships for the Graph Explorer visualization.

**Authentication:** None required.

**Request params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `limit` | number | no | Max relationships to return (default 200, capped at 1000) |

**Response `200`:**
```json
{
  "nodes": [{ "id": "4:abc:1", "label": "Brown Rice, cooked", "group": "Food" }],
  "links": [{ "id": "5:abc:1", "source": "4:abc:1", "target": "4:abc:2", "type": "SIMILAR_GI_TO" }]
}
```

**Response `500`:** `{ "error": "Failed to load graph data from Neo4j" }`

---

## Shared Notes

- All routes use a shared Neo4j driver singleton (`lib/neo4j.ts`) with `disableLosslessIntegers:
  true` so numeric properties return as plain JS numbers rather than Neo4j's internal integer
  representation.
- None of these routes currently enforce authentication or role-based access at the API layer —
  they trust client-supplied identifiers (email) rather than a verified server session. This is a
  known gap that should be addressed before final submission if RBAC is required for this module.
