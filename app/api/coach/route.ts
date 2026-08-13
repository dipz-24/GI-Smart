import { NextResponse } from "next/server";
import { GET as getMealPlan } from "@/app/api/meal-plan/route";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getAuthenticatedEmail } from "@/lib/server-session";
import type { Session } from "neo4j-driver";

const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type MealSlot = (typeof MEAL_SLOTS)[number];
type MealStatus = "pending" | "followed" | "different" | "skipped";

type MealItem = {
  name: string;
  category: string;
  portionG: number;
  gi: number;
  kcal: number;
  protein?: number;
  fibre?: number;
  carbs?: number;
  fat?: number;
};

type Meal = { foods: string[]; items?: MealItem[]; gi: number; kcal: number };
type MealPlanResponse = {
  days?: { day: string; meals: Partial<Record<MealSlot, Meal>> }[];
  dailyCalorieTarget?: number;
  source?: string;
};

type NutrientTotals = {
  kcal: number;
  protein: number;
  fibre: number;
  carbs: number;
  fat: number;
};

export async function POST(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const dayNumber = Number(body?.dayNumber);
  const statuses = Object.fromEntries(MEAL_SLOTS.map((slot) => {
    const submitted = body?.mealEntries?.[slot]?.status;
    const status: MealStatus = ["pending", "followed", "different", "skipped"].includes(submitted)
      ? submitted
      : Array.isArray(body?.completedSlots) && body.completedSlots.includes(slot) ? "followed" : "pending";
    return [slot, status];
  })) as Record<MealSlot, MealStatus>;
  const completedSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "followed");
  const differentSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "different");
  const skippedSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "skipped");
  const pendingSlots = MEAL_SLOTS.filter((slot) => statuses[slot] === "pending");
  const submittedActualFoods = differentSlots.flatMap((slot) => {
    const foods = Array.isArray(body?.mealEntries?.[slot]?.foods) ? body.mealEntries[slot].foods : [];
    return foods.map((food: { name?: unknown; portionG?: unknown }) => ({
      slot,
      name: String(food?.name || "").trim(),
      portionG: Number(food?.portionG),
    }));
  });
  const water = Number(body?.water);

  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 7) {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }
  if (!Number.isFinite(water) || water < 0 || water > 10) {
    return NextResponse.json({ error: "Water must be between 0 and 10 litres" }, { status: 400 });
  }
  if (submittedActualFoods.some((food) => !food.name || !Number.isFinite(food.portionG) || food.portionG < 10 || food.portionG > 1000)) {
    return NextResponse.json({ error: "Add a valid food and portion for meals marked different" }, { status: 400 });
  }
  if (differentSlots.some((slot) => !submittedActualFoods.some((food) => food.slot === slot))) {
    return NextResponse.json({ error: "Add at least one food for every meal marked different" }, { status: 400 });
  }

  const planResponse = await getMealPlan(request);
  if (!planResponse.ok) return planResponse;
  const plan = (await planResponse.json()) as MealPlanResponse;
  const day = plan.days?.[dayNumber - 1];
  if (!day) return NextResponse.json({ error: "Today's meal plan was not found" }, { status: 404 });

  const session = getNeo4jDriver().session();
  try {
    const profileResult = await session.run(
      `MATCH (u:User {email: $email})
       OPTIONAL MATCH (g:HealthGoal {type: u.healthGoal})
       RETURN coalesce(u.weight, 70) AS weight,
              coalesce(u.dailyWaterTarget, 2.5) AS waterTarget,
              coalesce(u.dietPreference, "omnivore") AS dietPreference,
              coalesce(u.glutenFree, false) AS glutenFree,
              coalesce(g.targetGIMax, 60) AS targetGIMax`,
      { email }
    );
    if (profileResult.records.length === 0) {
      return NextResponse.json({ error: "Complete your profile before using the coach" }, { status: 404 });
    }

    const profile = profileResult.records[0];
    const calorieTarget = Number(plan.dailyCalorieTarget || 2000);
    const proteinTarget = round1(Math.max(50, Number(profile.get("weight")) * 0.8));
    const fibreTarget = round1((calorieTarget / 1000) * 14);
    const waterTarget = Number(profile.get("waterTarget"));
    const targetGIMax = Number(profile.get("targetGIMax"));

    const followedMeals = completedSlots
      .map((slot) => day.meals[slot])
      .filter((meal): meal is Meal => Boolean(meal));
    const actualItems = await resolveActualFoods(session, submittedActualFoods);
    if (actualItems.length !== submittedActualFoods.length) {
      return NextResponse.json({ error: "One or more actual foods were not found in Neo4j" }, { status: 400 });
    }
    const consumed = addTotals(sumMeals(followedMeals), sumItems(actualItems));
    const remainingSlots = pendingSlots.filter((slot) => day.meals[slot]);
    const remainingMeals = remainingSlots.map((slot) => day.meals[slot] as Meal);
    const remainingTarget = Math.max(0, calorieTarget - consumed.kcal);
    const originalRemainingCalories = remainingMeals.reduce((sum, meal) => sum + meal.kcal, 0);
    const hasDeviation = differentSlots.length > 0 || skippedSlots.length > 0;
    const scaleFactor = hasDeviation && originalRemainingCalories > 0 && remainingTarget > 0
      ? Math.max(0.65, Math.min(1.35, remainingTarget / originalRemainingCalories))
      : 1;

    const recommendations = remainingSlots.map((slot) => {
      const meal = day.meals[slot] as Meal;
      const items = (meal.items || []).map((item) => scaleItem(item, scaleFactor));
      const totals = items.length ? sumItems(items) : {
        kcal: Math.round(meal.kcal * scaleFactor), protein: 0, fibre: 0, carbs: 0, fat: 0,
      };
      return {
        slot,
        gi: meal.gi,
        ...totals,
        items,
        foods: items.length ? items.map((item) => item.name) : meal.foods,
        reasons: [
          `GI ${meal.gi}, within your configured limit of ${targetGIMax}`,
          `${Math.round(totals.kcal)} kcal toward the remaining ${Math.round(remainingTarget)} kcal`,
          `${round1(totals.protein)} g protein and ${round1(totals.fibre)} g fibre`,
        ],
      };
    });
    const recommended = recommendations.reduce<NutrientTotals>(
      (total, meal) => addTotals(total, meal),
      emptyTotals()
    );
    const projected = addTotals(consumed, recommended);
    const dietPreference = String(profile.get("dietPreference"));
    const glutenFree = Boolean(profile.get("glutenFree"));
    const isDayComplete = remainingSlots.length === 0;
    const reviewTotals = isDayComplete ? consumed : projected;
    const review = buildNutritionReview(reviewTotals, {
      kcal: calorieTarget,
      protein: proteinTarget,
      fibre: fibreTarget,
      water: waterTarget,
    }, water);

    const insights = [
      hasDeviation
        ? `${[...differentSlots, ...skippedSlots].join(" and ")} changed from the plan, so the remaining portions were recalculated.`
        : completedSlots.length
          ? `${completedSlots.join(" and ")} followed as planned. No meal changes are needed.`
          : "No deviations are logged, so the coach is showing your existing plan.",
      `${Math.max(0, Math.round(calorieTarget - consumed.kcal)).toLocaleString()} kcal remain before the recommendation.`,
      water >= waterTarget
        ? `Your ${waterTarget.toFixed(1)} L water target is met.`
        : `${Math.max(0, waterTarget - water).toFixed(1)} L remains toward your water target.`,
      `All suggestions match ${dietPreference}${glutenFree ? " and gluten-free" : ""} settings.`,
    ];

    return NextResponse.json({
      day: day.day,
      completedSlots,
      differentSlots,
      skippedSlots,
      remainingSlots,
      targets: { kcal: calorieTarget, protein: proteinTarget, fibre: fibreTarget, water: waterTarget },
      consumed,
      remaining: {
        kcal: Math.max(0, Math.round(calorieTarget - consumed.kcal)),
        protein: Math.max(0, round1(proteinTarget - consumed.protein)),
        fibre: Math.max(0, round1(fibreTarget - consumed.fibre)),
        water: Math.max(0, round1(waterTarget - water)),
      },
      recommendations,
      projected,
      review,
      isDayComplete,
      insights,
      adjustedPortions: Math.abs(scaleFactor - 1) >= 0.025,
      adapted: hasDeviation,
      disclaimer: "Planning estimates use available food records and are not medical advice.",
    });
  } catch (error) {
    console.error("Adaptive GI Coach failed:", error);
    return NextResponse.json({ error: "The coach could not analyze today's plan" }, { status: 500 });
  } finally {
    await session.close();
  }
}

function scaleItem(item: MealItem, factor: number): MealItem {
  const oldPortion = Number(item.portionG || 100);
  const portionG = Math.max(20, Math.min(250, Math.round((oldPortion * factor) / 5) * 5));
  const actualFactor = portionG / oldPortion;
  return {
    ...item,
    portionG,
    kcal: Math.round(Number(item.kcal || 0) * actualFactor),
    protein: round1(Number(item.protein || 0) * actualFactor),
    fibre: round1(Number(item.fibre || 0) * actualFactor),
    carbs: round1(Number(item.carbs || 0) * actualFactor),
    fat: round1(Number(item.fat || 0) * actualFactor),
  };
}

async function resolveActualFoods(
  session: Session,
  foods: { slot: string; name: string; portionG: number }[]
): Promise<MealItem[]> {
  if (foods.length === 0) return [];
  const result = await session.run(
    `UNWIND $foods AS item
     MATCH (f:Food {name: item.name})
     RETURN f.name AS name, coalesce(f.category, "Uncategorized") AS category,
            item.portionG AS portionG, coalesce(f.giValue, -1) AS gi,
            coalesce(f.kcal, 0) AS kcal, coalesce(f.protein, 0) AS protein,
            coalesce(f.fibre, 0) AS fibre, coalesce(f.carbs, 0) AS carbs,
            coalesce(f.fat, 0) AS fat`,
    { foods }
  );
  return result.records.map((record) => {
    const portionG = Number(record.get("portionG"));
    const factor = portionG / 100;
    return {
      name: record.get("name"),
      category: record.get("category"),
      portionG,
      gi: Number(record.get("gi")),
      kcal: Math.round(Number(record.get("kcal")) * factor),
      protein: round1(Number(record.get("protein")) * factor),
      fibre: round1(Number(record.get("fibre")) * factor),
      carbs: round1(Number(record.get("carbs")) * factor),
      fat: round1(Number(record.get("fat")) * factor),
    };
  });
}

function sumMeals(meals: Meal[]) {
  return meals.reduce<NutrientTotals>((total, meal) => {
    const mealTotals = meal.items?.length
      ? sumItems(meal.items)
      : { kcal: meal.kcal, protein: 0, fibre: 0, carbs: 0, fat: 0 };
    return addTotals(total, mealTotals);
  }, emptyTotals());
}

function sumItems(items: MealItem[]) {
  return items.reduce<NutrientTotals>((total, item) => addTotals(total, {
    kcal: Number(item.kcal || 0),
    protein: Number(item.protein || 0),
    fibre: Number(item.fibre || 0),
    carbs: Number(item.carbs || 0),
    fat: Number(item.fat || 0),
  }), emptyTotals());
}

function emptyTotals(): NutrientTotals {
  return { kcal: 0, protein: 0, fibre: 0, carbs: 0, fat: 0 };
}

function addTotals(a: NutrientTotals, b: NutrientTotals): NutrientTotals {
  return {
    kcal: Math.round(a.kcal + b.kcal),
    protein: round1(a.protein + b.protein),
    fibre: round1(a.fibre + b.fibre),
    carbs: round1(a.carbs + b.carbs),
    fat: round1(a.fat + b.fat),
  };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function buildNutritionReview(
  totals: NutrientTotals,
  targets: { kcal: number; protein: number; fibre: number; water: number },
  water: number
) {
  const checks: Array<{ key: string; label: string; status: "met" | "warning"; message: string }> = [];
  const calorieMin = targets.kcal * 0.95;
  const calorieMax = targets.kcal * 1.05;
  if (totals.kcal < calorieMin) {
    checks.push({
      key: "calories",
      label: "Calories",
      status: "warning",
      message: `${Math.round(targets.kcal - totals.kcal).toLocaleString()} kcal below your estimated target`,
    });
  } else if (totals.kcal > calorieMax) {
    checks.push({
      key: "calories",
      label: "Calories",
      status: "warning",
      message: `${Math.round(totals.kcal - targets.kcal).toLocaleString()} kcal above your estimated target`,
    });
  } else {
    checks.push({ key: "calories", label: "Calories", status: "met", message: "Within your estimated target range" });
  }

  checks.push(totals.protein >= targets.protein
    ? { key: "protein", label: "Protein", status: "met", message: `${round1(totals.protein)} g meets the ${round1(targets.protein)} g reference` }
    : { key: "protein", label: "Protein", status: "warning", message: `${round1(targets.protein - totals.protein)} g below your reference minimum` });
  checks.push(totals.fibre >= targets.fibre
    ? { key: "fibre", label: "Fibre", status: "met", message: `${round1(totals.fibre)} g meets the ${round1(targets.fibre)} g reference` }
    : { key: "fibre", label: "Fibre", status: "warning", message: `${round1(targets.fibre - totals.fibre)} g below your reference` });
  checks.push(water >= targets.water
    ? { key: "water", label: "Water", status: "met", message: `${round1(water)} L meets your ${round1(targets.water)} L target` }
    : { key: "water", label: "Water", status: "warning", message: `${round1(targets.water - water)} L below your water target` });
  return checks;
}
