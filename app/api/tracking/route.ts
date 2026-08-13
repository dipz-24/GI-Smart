import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";
import type { Session } from "neo4j-driver";
import { getAuthenticatedEmail } from "@/lib/server-session";
import { getPlanningCategory, pickRotatingFood } from "@/lib/meal-categories";
import { isFoodAllowed, type DietPreference } from "@/lib/dietary-preferences";

const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
const SLOT_CATEGORIES: Record<(typeof MEAL_SLOTS)[number], string[]> = {
  Breakfast: ["Grains", "Fruit", "Dairy"],
  Lunch: ["Legume", "Grains", "Protein", "Vegetable"],
  Dinner: ["Protein", "Vegetable", "Grains"],
  Snacks: ["Nuts", "Fruit"],
};
const SLOT_PORTIONS: Record<(typeof MEAL_SLOTS)[number], number> = {
  Breakfast: 100,
  Lunch: 150,
  Dinner: 180,
  Snacks: 30,
};
const CATEGORY_PORTIONS: Record<string, number> = {
  Grains: 100,
  Fruit: 100,
  Dairy: 150,
  Legume: 120,
  Protein: 150,
  Vegetable: 150,
  Nuts: 30,
};

type TrackedMeal = { slot: string; foods: string[]; gi: number; kcal: number };
type MealStatus = "pending" | "followed" | "different" | "skipped";
type ActualFood = {
  slot: string;
  name: string;
  portionG: number;
  gi: number | null;
  kcal: number;
  protein: number;
  fibre: number;
};

function nullableRounded(value: unknown): number | null {
  return value === null || value === undefined ? null : Math.round(Number(value));
}

export async function GET(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    let userId = "U-001";
    let matchedByEmail = false;
    let waterGoal = 2.5;

    if (email) {
      const userResult = await session.run(
        `MATCH (u:User {email: $email})
         RETURN u.userId AS userId, coalesce(u.dailyWaterTarget, 2.5) AS waterGoal LIMIT 1`,
        { email }
      );
      if (userResult.records.length > 0) {
        userId = userResult.records[0].get("userId");
        waterGoal = Number(userResult.records[0].get("waterGoal"));
        matchedByEmail = true;
      }
    }

    if (!matchedByEmail) {
      return NextResponse.json({ days: [], matchedByEmail: false, waterGoal });
    }

    const result = await session.run(
      `MATCH (u:User {userId: $userId})-[:LOGGED]->(td:TrackingDay)
       WITH td, coalesce(td.logDate, substring(toString(td.date), 0, 10)) AS calendarDay
       ORDER BY coalesce(toString(td.updatedAt), toString(td.date)) DESC
       WITH calendarDay, collect(td)[0] AS td
       RETURN td.trackId AS trackId, calendarDay AS date, td.dayNumber AS dayNumber,
              td.totalKcal AS totalKcal, td.totalGI AS totalGI, td.adherenceScore AS adherenceScore,
              td.water AS water, td.notes AS notes, td.mealSlots AS mealSlots,
              td.followedSlots AS followedSlots, td.differentSlots AS differentSlots,
              td.skippedSlots AS skippedSlots, td.pendingSlots AS pendingSlots
       ORDER BY calendarDay DESC
       LIMIT 10`,
      { userId }
    );

    const trackIds = result.records.map((record) => record.get("trackId")).filter(Boolean);
    const actualResult = trackIds.length
      ? await session.run(
          `UNWIND $trackIds AS trackId
           MATCH (td:TrackingDay {trackId: trackId})-[tracked:TRACKED_FOOD]->(f:Food)
           WHERE tracked.source = "actual"
           RETURN trackId, collect({slot: tracked.mealSlot, name: f.name, portionG: tracked.portionG}) AS foods`,
          { trackIds }
        )
      : { records: [] };
    const actualByTrackId = new Map(
      actualResult.records.map((record) => [record.get("trackId"), record.get("foods")])
    );

    const days = result.records.map((r) => {
      const adherence = r.get("adherenceScore");
      const met = adherence >= 0.85 ? "yes" : adherence >= 0.7 ? "partial" : "no";
      const dateVal = r.get("date");
      const dateStr = dateVal && dateVal.toString ? dateVal.toString() : String(dateVal);
      const legacyMealSlots = (r.get("mealSlots") || []) as string[];
      const followedSlots = (r.get("followedSlots") || legacyMealSlots) as string[];
      const differentSlots = (r.get("differentSlots") || []) as string[];
      const skippedSlots = (r.get("skippedSlots") || []) as string[];
      const pendingSlots = (r.get("pendingSlots") || MEAL_SLOTS.filter(
        (slot) => !followedSlots.includes(slot) && !differentSlots.includes(slot) && !skippedSlots.includes(slot)
      )) as string[];
      return {
        trackId: r.get("trackId"),
        date: dateStr,
        gi: nullableRounded(r.get("totalGI")),
        kcal: nullableRounded(r.get("totalKcal")),
        adherence,
        met,
        water: Number(r.get("water") ?? 0),
        notes: r.get("notes") || "",
        mealSlots: legacyMealSlots,
        followedSlots,
        differentSlots,
        skippedSlots,
        pendingSlots,
        actualFoods: actualByTrackId.get(r.get("trackId")) || [],
      };
    });

    return NextResponse.json({ days, matchedByEmail, userId, waterGoal });
  } catch (err) {
    console.error("Neo4j tracking query failed:", err);
    return NextResponse.json({ error: "Failed to fetch tracking history" }, { status: 500 });
  } finally {
    await session.close();
  }
}

export async function POST(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { checks, mealEntries, water, notes, logDate } = body || {};

  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    let userId = "U-001";
    let goalType: string | null = null;
    let matchedByEmail = false;
    let dailyCalorieTarget = 2000;
    let dietPreference: DietPreference = "omnivore";
    let glutenFree = false;

    if (email) {
      const userResult = await session.run(
        `MATCH (u:User {email: $email})
         RETURN u.userId AS userId, u.healthGoal AS goal,
                coalesce(u.dailyCalorieTarget, 2000) AS dailyCalories,
                coalesce(u.dietPreference, "omnivore") AS dietPreference,
                coalesce(u.glutenFree, false) AS glutenFree LIMIT 1`,
        { email }
      );
      if (userResult.records.length > 0) {
        userId = userResult.records[0].get("userId");
        goalType = userResult.records[0].get("goal");
        dailyCalorieTarget = Number(userResult.records[0].get("dailyCalories"));
        dietPreference = userResult.records[0].get("dietPreference") as DietPreference;
        glutenFree = Boolean(userResult.records[0].get("glutenFree"));
        matchedByEmail = true;
      }
    }

    if (!matchedByEmail) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const date = new Date().toISOString();
    const effectiveLogDate =
      typeof logDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(logDate)
        ? logDate
        : date.slice(0, 10);
    const calendarDate = new Date(`${effectiveLogDate}T00:00:00Z`);
    if (Number.isNaN(calendarDate.getTime())) {
      return NextResponse.json({ error: "Invalid tracking date" }, { status: 400 });
    }
    const dayNumber = ((calendarDate.getUTCDay() + 6) % 7) + 1;
    const statuses = Object.fromEntries(MEAL_SLOTS.map((slot) => {
      const submitted = mealEntries?.[slot]?.status;
      const status: MealStatus = ["pending", "followed", "different", "skipped"].includes(submitted)
        ? submitted
        : checks?.[slot] ? "followed" : "pending";
      return [slot, status];
    })) as Record<(typeof MEAL_SLOTS)[number], MealStatus>;
    const followedSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "followed");
    const differentSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "different");
    const skippedSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "skipped");
    const pendingSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "pending");
    const submittedSlots = MEAL_SLOTS.filter((slot) => statuses[slot] !== "skipped");
    const submittedActualFoods = differentSlots.flatMap((slot) => {
      const foods = Array.isArray(mealEntries?.[slot]?.foods) ? mealEntries[slot].foods : [];
      return foods.map((food: { name?: unknown; portionG?: unknown }) => ({
        slot,
        name: String(food?.name || "").trim(),
        portionG: Number(food?.portionG),
      }));
    });
    if (submittedActualFoods.some((food) => !food.name || !Number.isFinite(food.portionG) || food.portionG < 10 || food.portionG > 1000)) {
      return NextResponse.json({ error: "Actual foods need a valid name and a portion between 10 g and 1,000 g" }, { status: 400 });
    }
    if (differentSlots.some((slot) => !submittedActualFoods.some((food) => food.slot === slot))) {
      return NextResponse.json({ error: "Add at least one food for every meal marked different" }, { status: 400 });
    }
    const existingResult = await session.run(
      `MATCH (u:User {userId: $userId})-[:LOGGED]->(td:TrackingDay)
       WHERE td.logDate = $logDate OR toString(td.date) STARTS WITH $logDate
       RETURN td.trackId AS trackId, td.mealSlots AS mealSlots
       ORDER BY coalesce(toString(td.updatedAt), toString(td.date)) DESC
       LIMIT 1`,
      { userId, logDate: effectiveLogDate }
    );
    const selectedSlots = submittedSlots;
    const trackedMeals = await getPlanMealsForDay(
      session,
      matchedByEmail,
      userId,
      goalType,
      dailyCalorieTarget,
      dietPreference,
      glutenFree,
      dayNumber,
      followedSlots
    );
    const actualFoods = await resolveActualFoods(session, submittedActualFoods);
    if (actualFoods.length !== submittedActualFoods.length) {
      return NextResponse.json({ error: "One or more actual foods were not found in Neo4j" }, { status: 400 });
    }
    const actualMeals = differentSlots.map((slot) => {
      const foods = actualFoods.filter((food) => food.slot === slot);
      const knownGI = foods.filter((food) => food.gi !== null);
      return {
        slot,
        foods: foods.map((food) => food.name),
        gi: knownGI.length ? knownGI.reduce((sum, food) => sum + Number(food.gi), 0) / knownGI.length : null,
        kcal: foods.reduce((sum, food) => sum + food.kcal, 0),
      };
    });
    const mealsWithGI = [...trackedMeals.map((meal) => ({ ...meal, gi: meal.gi as number | null })), ...actualMeals]
      .filter((meal): meal is { slot: string; foods: string[]; gi: number; kcal: number } => meal.gi !== null);
    const adherenceScore = followedSlots.length / MEAL_SLOTS.length;
    const totalGI = mealsWithGI.length
      ? Math.round(mealsWithGI.reduce((sum, meal) => sum + meal.gi, 0) / mealsWithGI.length)
      : null;
    const totalKcal = trackedMeals.length || actualMeals.length
      ? Math.round(trackedMeals.reduce((sum, meal) => sum + meal.kcal, 0) + actualMeals.reduce((sum, meal) => sum + meal.kcal, 0))
      : null;
    const totalProtein = actualFoods.reduce((sum, food) => sum + food.protein, 0);
    const totalFibre = actualFoods.reduce((sum, food) => sum + food.fibre, 0);
    const waterLitres = Number.parseFloat(String(water));
    if (!Number.isFinite(waterLitres) || waterLitres < 0 || waterLitres > 10) {
      return NextResponse.json({ error: "Water must be between 0 and 10 litres" }, { status: 400 });
    }
    const trackId =
      existingResult.records[0]?.get("trackId") ?? `TD-${userId}-${effectiveLogDate}`;

    await session.run(
      `MATCH (u:User {userId: $userId})
       MERGE (td:TrackingDay {trackId: $trackId})
       ON CREATE SET td.createdAt = datetime()
       SET td.date = $date,
           td.logDate = $logDate,
           td.dayNumber = $dayNumber,
           td.totalKcal = $totalKcal,
           td.totalGI = $totalGI,
           td.adherenceScore = $adherenceScore,
           td.mealSlots = $selectedSlots,
           td.followedSlots = $followedSlots,
           td.differentSlots = $differentSlots,
           td.skippedSlots = $skippedSlots,
           td.pendingSlots = $pendingSlots,
           td.actualProtein = $totalProtein,
           td.actualFibre = $totalFibre,
           td.water = $water,
           td.notes = $notes,
           td.updatedAt = datetime()
       MERGE (u)-[logged:LOGGED]->(td)
       ON CREATE SET logged.loggedAt = datetime()
       SET logged.updatedAt = datetime()`,
      {
        userId,
        trackId,
        date,
        logDate: effectiveLogDate,
        dayNumber,
        totalKcal,
        totalGI,
        adherenceScore,
        selectedSlots,
        followedSlots,
        differentSlots,
        skippedSlots,
        pendingSlots,
        totalProtein,
        totalFibre,
        water: waterLitres,
        notes: notes || "",
      }
    );

    const plannedFoods = trackedMeals.flatMap((meal) => meal.foods.map((name) => ({
      slot: meal.slot, name, portionG: null,
    })));
    await session.run(
      `MATCH (td:TrackingDay {trackId: $trackId})
       OPTIONAL MATCH (td)-[old:TRACKED_FOOD]->()
       DELETE old
       WITH DISTINCT td
       UNWIND $foods AS item
       MATCH (f:Food {name: item.name})
       MERGE (td)-[tracked:TRACKED_FOOD {mealSlot: item.slot}]->(f)
       SET tracked.source = item.source, tracked.portionG = item.portionG`,
      {
        trackId,
        foods: [
          ...plannedFoods.map((food) => ({ ...food, source: "planned" })),
          ...actualFoods.map((food) => ({ slot: food.slot, name: food.name, portionG: food.portionG, source: "actual" })),
        ],
      }
    );

    return NextResponse.json(
      { success: true, trackId, logDate: effectiveLogDate, gi: totalGI, kcal: totalKcal, water: waterLitres }
    );
  } catch (err) {
    console.error("Neo4j tracking save failed:", err);
    return NextResponse.json({ error: "Failed to save tracking log" }, { status: 500 });
  } finally {
    await session.close();
  }
}

export async function DELETE(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { logDate } = body || {};
  if (typeof logDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
  }

  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `MATCH (u:User {email: $email})-[:LOGGED]->(td:TrackingDay)
       WHERE td.logDate = $logDate OR toString(td.date) STARTS WITH $logDate
       WITH collect(DISTINCT td) AS days
       FOREACH (day IN days | DETACH DELETE day)
       RETURN size(days) AS deleted`,
      { email, logDate }
    );
    const deleted = Number(result.records[0]?.get("deleted") || 0);
    if (deleted === 0) {
      return NextResponse.json({ error: "Tracking log not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error("Neo4j tracking delete failed:", err);
    return NextResponse.json({ error: "Failed to delete tracking log" }, { status: 500 });
  } finally {
    await session.close();
  }
}

async function resolveActualFoods(
  session: Session,
  foods: { slot: string; name: string; portionG: number }[]
): Promise<ActualFood[]> {
  if (foods.length === 0) return [];
  const result = await session.run(
    `UNWIND $foods AS item
     MATCH (f:Food {name: item.name})
     RETURN item.slot AS slot, item.portionG AS portionG, f.name AS name,
            CASE WHEN f.giValue >= 0 THEN f.giValue ELSE null END AS gi,
            coalesce(f.kcal, 0) AS kcal, coalesce(f.protein, 0) AS protein,
            coalesce(f.fibre, 0) AS fibre`,
    { foods }
  );
  return result.records.map((record) => {
    const portionG = Number(record.get("portionG"));
    const factor = portionG / 100;
    return {
      slot: record.get("slot"),
      name: record.get("name"),
      portionG,
      gi: record.get("gi") === null ? null : Number(record.get("gi")),
      kcal: Number(record.get("kcal")) * factor,
      protein: Number(record.get("protein")) * factor,
      fibre: Number(record.get("fibre")) * factor,
    };
  });
}

async function getPlanMealsForDay(
  session: Session,
  matchedByEmail: boolean,
  userId: string,
  goalType: string | null,
  dailyCalorieTarget: number,
  dietPreference: DietPreference,
  glutenFree: boolean,
  dayNumber: number,
  selectedSlots: readonly string[]
): Promise<TrackedMeal[]> {
  if (selectedSlots.length === 0) return [];

  if (!matchedByEmail) {
    const result = await session.run(
      `MATCH (mp:MealPlan {planId: "MP-001"})-[inc:INCLUDES]->(f:Food)
       WHERE inc.dayNumber = $dayNumber AND inc.mealSlot IN $selectedSlots
       RETURN inc.mealSlot AS slot, collect(f.name) AS foods,
              avg(f.giValue) AS gi,
              sum(f.kcal * coalesce(inc.portionG, 100) / 100.0) AS kcal`,
      { dayNumber, selectedSlots: [...selectedSlots] }
    );
    return result.records.map((record) => ({
      slot: record.get("slot"),
      foods: record.get("foods"),
      gi: Number(record.get("gi")),
      kcal: Number(record.get("kcal")),
    }));
  }

  let targetGIMax = 60;
  if (goalType) {
    const goalResult = await session.run(
      "MATCH (g:HealthGoal {type: $goalType}) RETURN g.targetGIMax AS maxGI LIMIT 1",
      { goalType }
    );
    if (goalResult.records.length > 0) {
      targetGIMax = Number(goalResult.records[0].get("maxGI"));
    }
  }

  const candidatesResult = await session.run(
    `MATCH (f:Food)
     WHERE f.giValue >= 0 AND f.giValue <= $maxGI
     RETURN f.name AS name, f.giValue AS gi, f.kcal AS kcal, f.category AS category
     ORDER BY f.name ASC`,
    { maxGI: targetGIMax }
  );
  const byCategory: Record<string, { name: string; gi: number; kcal: number }[]> = {};
  for (const record of candidatesResult.records) {
    const category = getPlanningCategory(record.get("category"), record.get("name"));
    if (!isFoodAllowed(record.get("name"), category, dietPreference, glutenFree)) continue;
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push({
      name: record.get("name"),
      gi: Number(record.get("gi")),
      kcal: Number(record.get("kcal")),
    });
  }
  if (dietPreference !== "omnivore") {
    byCategory.Protein = [...(byCategory.Protein || []), ...(byCategory.Legume || [])];
  }

  const savedResult = await session.run(
    `MATCH (:User {userId: $userId})-[:SELECTED_MEAL]->(ms:MealSelection)-[selected:FOOD]->(f:Food)
     WHERE ms.dayNumber = $dayNumber AND ms.mealSlot IN $selectedSlots
     RETURN ms.mealSlot AS slot, coalesce(selected.portionG, ms.portionG, 100) AS portionG,
            coalesce(selected.category, f.category) AS category,
            f.name AS name, f.giValue AS gi, f.kcal AS kcal`,
    { userId, dayNumber, selectedSlots: [...selectedSlots] }
  );
  const savedBySlot = new Map<string, { name: string; category: string; gi: number; kcal: number; portionG: number }[]>();
  for (const record of savedResult.records) {
    const slot = record.get("slot");
    if (!savedBySlot.has(slot)) savedBySlot.set(slot, []);
    const category = getPlanningCategory(record.get("category"), record.get("name"));
    if (!isFoodAllowed(record.get("name"), category, dietPreference, glutenFree)) continue;
    savedBySlot.get(slot)!.push({
      name: record.get("name"),
      category,
      gi: Number(record.get("gi")),
      kcal: Number(record.get("kcal")),
      portionG: Number(record.get("portionG")),
    });
  }

  const meals: TrackedMeal[] = [];
  let seed = 0;
  const lastUsedDay = new Map<string, number>();
  for (let day = 1; day <= dayNumber; day++) {
    const usedToday = new Set<string>();
    const generatedBySlot = new Map<string, { name: string; category: string; portionG: number; gi: number; kcal: number }[]>();
    for (const slot of MEAL_SLOTS) {
      const generated: { name: string; category: string; portionG: number; gi: number; kcal: number }[] = [];
      for (const category of SLOT_CATEGORIES[slot]) {
        const food = pickRotatingFood(
          byCategory[category] || [], usedToday, lastUsedDay, day, seed++
        );
        if (!food) continue;
        usedToday.add(food.name);
        lastUsedDay.set(food.name, day);
        const portionG = CATEGORY_PORTIONS[category] || SLOT_PORTIONS[slot];
        generated.push({
          name: food.name,
          category,
          portionG,
          gi: food.gi,
          kcal: (food.kcal * portionG) / 100,
        });
      }
      if (generated.length > 0) generatedBySlot.set(slot, generated);
    }
    normalizeGeneratedDay(generatedBySlot, dailyCalorieTarget);

    if (day === dayNumber) {
      for (const slot of MEAL_SLOTS) {
        if (!selectedSlots.includes(slot)) continue;
        const generated = generatedBySlot.get(slot);
        if (!generated?.length) continue;
        const saved = savedBySlot.get(slot);
        if (saved?.length) {
          const merged = new Map(generated.map((food) => [food.category, food]));
          for (const food of saved) {
            merged.set(food.category, {
              name: food.name,
              category: food.category,
              portionG: food.portionG,
              gi: food.gi,
              kcal: (food.kcal * food.portionG) / 100,
            });
          }
          const foods = SLOT_CATEGORIES[slot]
            .map((category) => merged.get(category))
            .filter((food): food is { name: string; category: string; portionG: number; gi: number; kcal: number } => Boolean(food));
          meals.push({
            slot,
            foods: foods.map((food) => food.name),
            gi: foods.reduce((sum, food) => sum + food.gi, 0) / foods.length,
            kcal: foods.reduce((sum, food) => sum + food.kcal, 0),
          });
          continue;
        }
        meals.push({
          slot,
          foods: generated.map((food) => food.name),
          gi: generated.reduce((sum, food) => sum + food.gi, 0) / generated.length,
          kcal: generated.reduce((sum, food) => sum + food.kcal, 0),
        });
      }
    }
  }
  return meals;
}

function normalizeGeneratedDay(
  meals: Map<string, { name: string; category: string; portionG: number; gi: number; kcal: number }[]>,
  target: number
) {
  const items = [...meals.values()].flat();
  const total = items.reduce((sum, item) => sum + item.kcal, 0);
  if (total === 0 || (total >= target * 0.95 && total <= target * 1.05)) return;
  const factor = target / total;
  for (const item of items) {
    const oldPortion = item.portionG;
    const newPortion = Math.max(20, Math.min(250, Math.round((oldPortion * factor) / 5) * 5));
    item.portionG = newPortion;
    item.kcal = (item.kcal * newPortion) / oldPortion;
  }
}
