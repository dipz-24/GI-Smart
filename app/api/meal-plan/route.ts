import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";
import type { Session } from "neo4j-driver";
import { getAuthenticatedEmail } from "@/lib/server-session";
import { getPlanningCategory, pickRotatingFood } from "@/lib/meal-categories";
import { isFoodAllowed, type DietPreference } from "@/lib/dietary-preferences";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SLOT_CATEGORIES: Record<string, string[]> = {
  Breakfast: ["Grains", "Fruit", "Dairy"],
  Lunch: ["Legume", "Grains", "Protein", "Vegetable"],
  Dinner: ["Protein", "Vegetable", "Grains"],
  Snacks: ["Nuts", "Fruit"],
};
const SLOT_PORTIONS: Record<string, number> = { Breakfast: 100, Lunch: 150, Dinner: 180, Snacks: 30 };
const CATEGORY_PORTIONS: Record<string, number> = {
  Grains: 100,
  Fruit: 100,
  Dairy: 150,
  Legume: 120,
  Protein: 150,
  Vegetable: 150,
  Nuts: 30,
};

export type MealItem = {
  name: string;
  category: string;
  portionG: number;
  gi: number;
  kcal: number;
  protein: number;
  fibre: number;
  carbs: number;
  fat: number;
};
type Meal = { foods: string[]; items: MealItem[]; gi: number; kcal: number };

export async function GET(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    let goalType: string | null = null;
    let targetGIMax = 60;
    let matchedByEmail = false;
    let userId: string | null = null;
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

        const goalResult = await session.run(
          "MATCH (g:HealthGoal {type: $goalType}) RETURN g.targetGIMax AS maxGI LIMIT 1",
          { goalType }
        );
        if (goalResult.records.length > 0) {
          targetGIMax = goalResult.records[0].get("maxGI");
        }
      }
    }

    // Fallback: no matched user at all -> show the original static seed plan
    if (!matchedByEmail) {
      const result = await session.run(
        `MATCH (mp:MealPlan {planId: "MP-001"})-[inc:INCLUDES]->(f:Food)
         RETURN mp.totalAvgGI AS avgGI, inc.dayNumber AS day, inc.mealSlot AS slot,
                f.name AS foodName, f.giValue AS gi, f.kcal AS kcal,
                coalesce(inc.portionG, 100) AS portionG
         ORDER BY inc.dayNumber ASC, inc.mealSlot ASC`
      );
      const days = buildDaysFromRecords(result.records);
      return NextResponse.json({
        summary: "Sample plan (no account matched) - showing a default 7-day plan.",
        days,
        matchedByEmail: false,
        source: "sample",
      });
    }

    // Generate a real plan from the graph based on this user's HealthGoal
    const candidatesResult = await session.run(
      `MATCH (f:Food)
       WHERE f.giValue >= 0 AND f.giValue <= $maxGI
       RETURN f.name AS name, f.giValue AS gi, f.kcal AS kcal, f.category AS category,
              coalesce(f.protein, 0) AS protein, coalesce(f.fibre, 0) AS fibre,
              coalesce(f.carbs, 0) AS carbs, coalesce(f.fat, 0) AS fat
       ORDER BY f.name ASC`,
      { maxGI: targetGIMax }
    );

    const byCategory: Record<string, {
      name: string; gi: number; kcal: number; protein: number; fibre: number; carbs: number; fat: number;
    }[]> = {};
    for (const r of candidatesResult.records) {
      const cat = getPlanningCategory(r.get("category"), r.get("name"));
      if (!isFoodAllowed(r.get("name"), cat, dietPreference, glutenFree)) continue;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        name: r.get("name"),
        gi: Number(r.get("gi")),
        kcal: Number(r.get("kcal")),
        protein: Number(r.get("protein")),
        fibre: Number(r.get("fibre")),
        carbs: Number(r.get("carbs")),
        fat: Number(r.get("fat")),
      });
    }
    if (dietPreference !== "omnivore") {
      byCategory.Protein = [...(byCategory.Protein || []), ...(byCategory.Legume || [])];
    }

    const days = [];
    let seed = 0;
    const lastUsedDay = new Map<string, number>();
    for (let day = 1; day <= 7; day++) {
      const meals: Record<string, Meal> = {};
      const usedToday = new Set<string>();
      for (const slot of ["Breakfast", "Lunch", "Dinner", "Snacks"]) {
        const items: MealItem[] = [];
        for (const category of SLOT_CATEGORIES[slot]) {
          const picked = pickRotatingFood(
            byCategory[category] || [], usedToday, lastUsedDay, day, seed++
          );
          if (!picked) continue;
          usedToday.add(picked.name);
          lastUsedDay.set(picked.name, day);
          const portionG = CATEGORY_PORTIONS[category] || SLOT_PORTIONS[slot];
          items.push({
            name: picked.name,
            category,
            portionG,
            gi: picked.gi,
            kcal: Math.round((picked.kcal * portionG) / 100),
            protein: roundNutrient((picked.protein * portionG) / 100),
            fibre: roundNutrient((picked.fibre * portionG) / 100),
            carbs: roundNutrient((picked.carbs * portionG) / 100),
            fat: roundNutrient((picked.fat * portionG) / 100),
          });
        }
        if (items.length === 0) continue;
        meals[slot] = {
          foods: items.map((item) => item.name),
          items,
          gi: Math.round(items.reduce((sum, item) => sum + item.gi, 0) / items.length),
          kcal: items.reduce((sum, item) => sum + item.kcal, 0),
        };
      }
      normalizeDayCalories(meals, dailyCalorieTarget);
      days.push({ day: DAY_NAMES[day - 1], meals });
    }

    if (userId) {
      await applySavedSelections(session, userId, days, dietPreference, glutenFree);
    }

    const avgGI = Math.round(
      days.flatMap((d) => Object.values(d.meals)).reduce((sum, m: any) => sum + m.gi, 0) /
        days.flatMap((d) => Object.values(d.meals)).length
    );

    return NextResponse.json({
      summary: "Generated from your " + goalType + " goal - foods with GI at or below " + targetGIMax + " (avg GI: " + avgGI + ").",
      days,
      matchedByEmail: true,
      source: "generated",
      dailyCalorieTarget,
    });
  } catch (err) {
    console.error("Neo4j meal-plan query failed:", err);
    return NextResponse.json({ error: "Failed to fetch meal plan" }, { status: 500 });
  } finally {
    await session.close();
  }
}

function normalizeDayCalories(meals: Record<string, Meal>, target: number) {
  const items = Object.values(meals).flatMap((meal) => meal.items);
  const total = items.reduce((sum, item) => sum + item.kcal, 0);
  const min = target * 0.95;
  const max = target * 1.05;
  if (total === 0 || (total >= min && total <= max)) return;

  const factor = target / total;
  for (const item of items) {
    const oldPortion = item.portionG;
    const newPortion = Math.max(20, Math.min(250, Math.round((oldPortion * factor) / 5) * 5));
    item.portionG = newPortion;
    item.kcal = Math.round((item.kcal * newPortion) / oldPortion);
    item.protein = roundNutrient((item.protein * newPortion) / oldPortion);
    item.fibre = roundNutrient((item.fibre * newPortion) / oldPortion);
    item.carbs = roundNutrient((item.carbs * newPortion) / oldPortion);
    item.fat = roundNutrient((item.fat * newPortion) / oldPortion);
  }
  for (const meal of Object.values(meals)) {
    meal.kcal = meal.items.reduce((sum, item) => sum + item.kcal, 0);
  }
}

function roundNutrient(value: number) {
  return Math.round(value * 10) / 10;
}

export async function PATCH(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { dayNumber, mealSlot, currentItems, dayFoods } = body || {};
  if (
    !Number.isInteger(dayNumber) ||
    dayNumber < 1 ||
    dayNumber > 7 ||
    !Object.hasOwn(SLOT_CATEGORIES, mealSlot) ||
    !Array.isArray(currentItems) ||
    !Array.isArray(dayFoods)
  ) {
    return NextResponse.json({ error: "Invalid shuffle request" }, { status: 400 });
  }

  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const userResult = await session.run(
      `MATCH (u:User {email: $email})
       OPTIONAL MATCH (g:HealthGoal {type: u.healthGoal})
       RETURN u.userId AS userId, coalesce(g.targetGIMax, 60) AS maxGI,
              coalesce(u.dietPreference, "omnivore") AS dietPreference,
              coalesce(u.glutenFree, false) AS glutenFree`,
      { email }
    );
    if (userResult.records.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userResult.records[0].get("userId");
    const maxGI = Number(userResult.records[0].get("maxGI"));
    const dietPreference = userResult.records[0].get("dietPreference") as DietPreference;
    const glutenFree = Boolean(userResult.records[0].get("glutenFree"));
    const selectionId = `${userId}-${dayNumber}-${mealSlot}`;
    const currentNames = currentItems.map((item: { name?: string }) => item.name).filter(Boolean);
    const items: MealItem[] = [];
    let changedItems = 0;
    for (const category of SLOT_CATEGORIES[mealSlot]) {
      const currentItem = currentItems.find((item: { category?: string }) => item.category === category);
      const alternativeResult = await session.run(
        `MATCH (f:Food)
         WHERE (f.category = $category OR f.category = "Uncategorized")
           AND f.giValue >= 0 AND f.giValue <= $maxGI
           AND NOT f.name IN $currentNames
         OPTIONAL MATCH (usedUser:User {userId: $userId})-[:SELECTED_MEAL]->(:MealSelection)-[:FOOD]->(f)
         WITH f, count(usedUser) AS alreadyUsed
         RETURN f.name AS name, f.category AS storedCategory,
                f.giValue AS gi, f.kcal AS kcal,
                coalesce(f.protein, 0) AS protein, coalesce(f.fibre, 0) AS fibre,
                coalesce(f.carbs, 0) AS carbs, coalesce(f.fat, 0) AS fat
         ORDER BY CASE WHEN f.name IN $dayFoods THEN 1 ELSE 0 END,
                  alreadyUsed ASC,
                  abs(f.kcal - $currentKcal) ASC, f.giValue ASC, f.name ASC
         LIMIT 50`,
        {
          category,
          maxGI,
          currentNames,
          dayFoods,
          currentKcal: currentItem?.portionG
            ? (Number(currentItem.kcal) * 100) / Number(currentItem.portionG)
            : Number(currentItem?.kcal || 0),
          userId,
        }
      );
      const alternative = alternativeResult.records.find((record) => {
        const planningCategory = getPlanningCategory(record.get("storedCategory"), record.get("name"));
        return planningCategory === category &&
          isFoodAllowed(record.get("name"), planningCategory, dietPreference, glutenFree);
      });
      if (!alternative) {
        if (currentItem?.name) items.push(currentItem as MealItem);
        continue;
      }
      const portionG = CATEGORY_PORTIONS[category] || SLOT_PORTIONS[mealSlot];
      changedItems++;
      items.push({
        name: alternative.get("name"),
        category,
        portionG,
        gi: Number(alternative.get("gi")),
        kcal: Math.round((Number(alternative.get("kcal")) * portionG) / 100),
        protein: roundNutrient((Number(alternative.get("protein")) * portionG) / 100),
        fibre: roundNutrient((Number(alternative.get("fibre")) * portionG) / 100),
        carbs: roundNutrient((Number(alternative.get("carbs")) * portionG) / 100),
        fat: roundNutrient((Number(alternative.get("fat")) * portionG) / 100),
      });
    }
    if (changedItems === 0) {
      return NextResponse.json({ error: "No suitable alternative found" }, { status: 404 });
    }

    await session.run(
      `MATCH (u:User {userId: $userId})
       MERGE (ms:MealSelection {selectionId: $selectionId})
       SET ms.dayNumber = $dayNumber, ms.mealSlot = $mealSlot,
           ms.updatedAt = datetime()
       MERGE (u)-[:SELECTED_MEAL]->(ms)
       WITH ms
       OPTIONAL MATCH (ms)-[old:FOOD]->()
       DELETE old
       WITH DISTINCT ms
       UNWIND $items AS item
       MATCH (f:Food {name: item.name})
       MERGE (ms)-[selected:FOOD {category: item.category}]->(f)
       SET selected.portionG = item.portionG`,
      { userId, selectionId, dayNumber, mealSlot, items }
    );

    return NextResponse.json({
      dayNumber,
      mealSlot,
      meal: {
        foods: items.map((item) => item.name),
        items,
        gi: Math.round(items.reduce((sum, item) => sum + item.gi, 0) / items.length),
        kcal: items.reduce((sum, item) => sum + item.kcal, 0),
      },
    });
  } catch (err) {
    console.error("Neo4j meal shuffle failed:", err);
    return NextResponse.json({ error: "Failed to shuffle meal" }, { status: 500 });
  } finally {
    await session.close();
  }
}

async function applySavedSelections(
  session: Session,
  userId: string,
  days: { day: string; meals: Record<string, Meal> }[],
  dietPreference: DietPreference,
  glutenFree: boolean
) {
  const result = await session.run(
    `MATCH (:User {userId: $userId})-[:SELECTED_MEAL]->(ms:MealSelection)-[selected:FOOD]->(f:Food)
     RETURN ms.dayNumber AS dayNumber, ms.mealSlot AS mealSlot,
            coalesce(selected.category, f.category) AS category,
            coalesce(selected.portionG, ms.portionG, 100) AS portionG,
            f.name AS name, f.giValue AS gi, f.kcal AS kcal,
            coalesce(f.protein, 0) AS protein, coalesce(f.fibre, 0) AS fibre,
            coalesce(f.carbs, 0) AS carbs, coalesce(f.fat, 0) AS fat
     ORDER BY category`,
    { userId }
  );
  const saved = new Map<string, MealItem[]>();
  for (const record of result.records) {
    const dayNumber = Number(record.get("dayNumber"));
    const mealSlot = record.get("mealSlot");
    const key = `${dayNumber}-${mealSlot}`;
    const portionG = Number(record.get("portionG"));
    const category = getPlanningCategory(record.get("category"), record.get("name"));
    if (!isFoodAllowed(record.get("name"), category, dietPreference, glutenFree)) continue;
    if (!saved.has(key)) saved.set(key, []);
    saved.get(key)!.push({
      name: record.get("name"),
      category,
      portionG,
      gi: Number(record.get("gi")),
      kcal: Math.round((Number(record.get("kcal")) * portionG) / 100),
      protein: roundNutrient((Number(record.get("protein")) * portionG) / 100),
      fibre: roundNutrient((Number(record.get("fibre")) * portionG) / 100),
      carbs: roundNutrient((Number(record.get("carbs")) * portionG) / 100),
      fat: roundNutrient((Number(record.get("fat")) * portionG) / 100),
    });
  }
  for (const [key, items] of saved) {
    const [dayText, mealSlot] = key.split("-");
    const dayNumber = Number(dayText);
    if (!days[dayNumber - 1] || !Object.hasOwn(SLOT_CATEGORIES, mealSlot)) continue;
    const baseItems = days[dayNumber - 1].meals[mealSlot]?.items || [];
    const mergedByCategory = new Map(baseItems.map((item) => [item.category, item]));
    for (const item of items) mergedByCategory.set(item.category, item);
    const mergedItems = SLOT_CATEGORIES[mealSlot]
      .map((category) => mergedByCategory.get(category))
      .filter((item): item is MealItem => Boolean(item));
    days[dayNumber - 1].meals[mealSlot] = {
      foods: mergedItems.map((item) => item.name),
      items: mergedItems,
      gi: Math.round(mergedItems.reduce((sum, item) => sum + item.gi, 0) / mergedItems.length),
      kcal: mergedItems.reduce((sum, item) => sum + item.kcal, 0),
    };
  }
}

function buildDaysFromRecords(records: any[]) {
  const dayMap: Record<number, Record<string, { foods: string[]; giSum: number; kcalSum: number; count: number }>> = {};
  for (const r of records) {
    const day = r.get("day");
    const slot = r.get("slot");
    if (!dayMap[day]) dayMap[day] = {};
    if (!dayMap[day][slot]) dayMap[day][slot] = { foods: [], giSum: 0, kcalSum: 0, count: 0 };
    dayMap[day][slot].foods.push(r.get("foodName"));
    dayMap[day][slot].giSum += r.get("gi");
    dayMap[day][slot].kcalSum += (r.get("kcal") * r.get("portionG")) / 100;
    dayMap[day][slot].count += 1;
  }
  return Object.keys(dayMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((dayNum) => {
      const meals: Record<string, { foods: string[]; gi: number; kcal: number }> = {};
      for (const slot of Object.keys(dayMap[dayNum])) {
        const m = dayMap[dayNum][slot];
        meals[slot] = {
          foods: m.foods,
          gi: Math.round(m.giSum / m.count),
          kcal: Math.round(m.kcalSum),
        };
      }
      return { day: DAY_NAMES[dayNum - 1] || "Day " + dayNum, meals };
    });
}
