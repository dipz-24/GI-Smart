import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";

export async function GET() {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.run(
      "MATCH (f:Food) RETURN f.foodId AS foodId, f.name AS name, f.giValue AS gi, f.kcal AS kcal, f.carbs AS carbs, f.protein AS protein, f.fat AS fat, f.fibre AS fibre, f.category AS category ORDER BY f.name ASC"
    );

    const foods = result.records.map((r) => {
      const gi = r.get("gi");
      const tier = gi < 0 ? "unknown" : gi <= 55 ? "low" : gi <= 69 ? "medium" : "high";
      return {
        foodId: r.get("foodId"),
        name: r.get("name"),
        category: r.get("category"),
        gi: gi,
        tier: tier,
        kcal: r.get("kcal"),
        carbs: r.get("carbs"),
        protein: r.get("protein"),
        fat: r.get("fat"),
      };
    });

    return NextResponse.json({ foods: foods });
  } catch (err) {
    console.error("Neo4j foods query failed:", err);
    return NextResponse.json({ error: "Failed to fetch foods" }, { status: 500 });
  } finally {
    await session.close();
  }
}