import { NextResponse } from "next/server";
import { Node as Neo4jNode, Relationship } from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/neo4j";

export interface GraphNode {
  id: string;
  label: string;
  group: string; // primary Neo4j label, used for color-coding in the UI
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
}

// Picks a human-readable label for a node depending on which
// properties it actually has (Food -> name, User -> name, etc).
function displayLabel(node: Neo4jNode): string {
  const props = node.properties as Record<string, unknown>;
  return (
    (props.name as string) ||
    (props.planId as string) ||
    (props.trackId as string) ||
    (props.email as string) ||
    node.labels[0] ||
    node.elementId
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Cap how much of the graph gets pulled back — keep the visual readable
  // and the response fast. Adjust via ?limit=500 if you want more.
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000);

  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (a)-[r]->(b)
       RETURN a, r, b
       LIMIT $limit`,
      { limit: neo4jInt(limit) }
    );

    const nodesById = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    for (const record of result.records) {
      const a = record.get("a") as Neo4jNode;
      const b = record.get("b") as Neo4jNode;
      const r = record.get("r") as Relationship;

      if (!nodesById.has(a.elementId)) {
        nodesById.set(a.elementId, {
          id: a.elementId,
          label: displayLabel(a),
          group: a.labels[0] ?? "Unknown",
        });
      }
      if (!nodesById.has(b.elementId)) {
        nodesById.set(b.elementId, {
          id: b.elementId,
          label: displayLabel(b),
          group: b.labels[0] ?? "Unknown",
        });
      }

      links.push({
        id: r.elementId,
        source: a.elementId,
        target: b.elementId,
        type: r.type,
      });
    }

    return NextResponse.json({
      nodes: Array.from(nodesById.values()),
      links,
    });
  } catch (err) {
    console.error("Neo4j graph query failed:", err);
    return NextResponse.json(
      { error: "Failed to load graph data from Neo4j" },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}

// Small helper so callers can pass a plain JS number for LIMIT;
// the driver needs an explicit Neo4j Integer for numeric params.
function neo4jInt(n: number) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const neo4j = require("neo4j-driver");
  return neo4j.int(n);
}