import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";

// Matches loosely on name since the app's static food list and the
// graph's loaded food names don't always match exactly
// (e.g. "Brown Rice" in the UI vs "Brown Rice, cooked" in the graph).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Missing 'name' query param" }, { status: 400 });
  }

  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (f:Food)
       WHERE toLower(f.name) CONTAINS toLower($name)
          OR toLower($name) CONTAINS toLower(f.name)
       WITH f
       ORDER BY size(f.name) ASC
       LIMIT 1
       OPTIONAL MATCH (f)-[r:SIMILAR_GI_TO]->(alt:Food)
       WHERE alt.giValue < f.giValue
       RETURN f.name AS matchedFood, f.giValue AS matchedGI,
              alt.name AS name, alt.giValue AS giValue, alt.kcal AS kcal,
              alt.category AS category, r.giDifference AS giDifference
       ORDER BY alt.giValue ASC
       LIMIT 5`,
      { name }
    );

    if (result.records.length === 0) {
      return NextResponse.json({ matchedFood: null, alternatives: [] });
    }

    const matchedFood = result.records[0].get("matchedFood");
    const matchedGI = result.records[0].get("matchedGI");

    const alternatives = result.records
      .filter((r) => r.get("name") !== null)
      .map((r) => ({
        name: r.get("name"),
        giValue: r.get("giValue"),
        kcal: r.get("kcal"),
        category: r.get("category"),
        giDifference: r.get("giDifference"),
      }));

    return NextResponse.json({ matchedFood, matchedGI, alternatives });
  } catch (err) {
    console.error("Neo4j alternatives query failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch alternatives from Neo4j" },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}