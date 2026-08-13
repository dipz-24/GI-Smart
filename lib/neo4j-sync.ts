
import { getNeo4jDriver } from "./neo4j";

function mapGoalToType(goal: string): string {
  const g = (goal || "").toLowerCase();
  if (g.indexOf("sugar") !== -1 || g.indexOf("diabetes") !== -1) return "BloodSugarControl";
  if (g.indexOf("weight") !== -1) return "WeightLoss";
  if (g.indexOf("heart") !== -1) return "HeartHealth";
  return "BloodSugarControl";
}

export async function syncUserToNeo4j(user: { id: string; email: string; name: string; goal?: string }) {
  const driver = getNeo4jDriver();
  const session = driver.session();
  const goalType = mapGoalToType(user.goal || "");
  try {
    await session.run(
      `MERGE (u:User {email: $email})
       SET u.userId = coalesce(u.userId, $userId),
           u.name = $name,
           u.healthGoal = $goalType,
           u.active = true,
           u.createdAt = coalesce(u.createdAt, date())
       WITH u
       MATCH (g:HealthGoal {type: $goalType})
       MERGE (u)-[:HAS_GOAL {setAt: date(), active: true}]->(g)
       WITH u
       MATCH (mp:MealPlan {planId: "MP-001"})
       MERGE (u)-[:FOLLOWS {startedAt: date(), adherence: 0.8}]->(mp)`,
      { email: user.email, userId: user.id, name: user.name, goalType: goalType }
    );
  } catch (err) {
    console.error("Failed to sync new user to Neo4j:", err);
  } finally {
    await session.close();
  }
}