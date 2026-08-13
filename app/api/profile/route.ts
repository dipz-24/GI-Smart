import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";
import { calculateDailyCalories, calculateDailyWater } from "@/lib/calories";
import { getAuthenticatedEmail } from "@/lib/server-session";

function mapGoalToType(goal: string) {
  if (goal === "Weight Loss") return "WeightLoss";
  if (goal === "Blood Sugar Control") return "BloodSugarControl";
  if (goal === "Sports Performance") return "SportsPerformance";
  return "BloodSugarControl";
}

export async function GET(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `MATCH (u:User {email: $email})
       RETURN u.age AS age, u.weight AS weight, u.height AS height,
              u.activity AS activity, u.profileGoal AS goal,
              u.targetWeight AS targetWeight, u.goalWeeks AS weeks,
              u.dailyCalorieTarget AS dailyCalories,
              u.dailyWaterTarget AS dailyWater,
              coalesce(u.dietPreference, "omnivore") AS dietPreference,
              coalesce(u.glutenFree, false) AS glutenFree`,
      { email }
    );
    if (result.records.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const record = result.records[0];
    return NextResponse.json({
      age: record.get("age"),
      weight: record.get("weight"),
      height: record.get("height"),
      activity: record.get("activity"),
      goal: record.get("goal"),
      targetWeight: record.get("targetWeight"),
      weeks: record.get("weeks"),
      dailyCalories: record.get("dailyCalories"),
      dailyWater: record.get("dailyWater"),
      dietPreference: record.get("dietPreference"),
      glutenFree: record.get("glutenFree"),
    });
  } finally {
    await session.close();
  }
}

export async function PUT(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const age = Number(body?.age);
  const weight = Number(body?.weight);
  const height = Number(body?.height);
  const weeks = body?.weeks ? Number(body.weeks) : null;
  const targetWeight = body?.targetWeight ? Number(body.targetWeight) : null;
  const activity = String(body?.activity || "");
  const goal = String(body?.goal || "General Health");
  const dietPreference = String(body?.dietPreference || "omnivore");
  const glutenFree = Boolean(body?.glutenFree);
  if (
    age < 10 || age > 120 ||
    weight < 20 || weight > 300 ||
    height < 50 || height > 250 ||
    !["sedentary", "light", "moderate", "active", "very_active"].includes(activity) ||
    !["omnivore", "vegetarian", "vegan"].includes(dietPreference)
  ) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }

  const dailyCalories = calculateDailyCalories({
    age, weight, height, activity, goal, targetWeight, weeks,
  });
  const healthGoal = mapGoalToType(goal);
  const dailyWater = calculateDailyWater(weight, activity);
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `MATCH (u:User {email: $email})
       SET u.age = $age, u.weight = $weight, u.height = $height,
           u.activity = $activity, u.profileGoal = $goal,
           u.healthGoal = $healthGoal,
           u.targetWeight = $targetWeight, u.goalWeeks = $weeks,
           u.dailyCalorieTarget = $dailyCalories,
           u.dailyWaterTarget = $dailyWater,
           u.dietPreference = $dietPreference, u.glutenFree = $glutenFree,
           u.profileUpdatedAt = datetime()
       RETURN u.dailyCalorieTarget AS dailyCalories, u.dailyWaterTarget AS dailyWater`,
      {
        email, age, weight, height, activity, goal,
        targetWeight, weeks, dailyCalories, dailyWater, healthGoal,
        dietPreference, glutenFree,
      }
    );
    if (result.records.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, dailyCalories, dailyWater });
  } finally {
    await session.close();
  }
}
