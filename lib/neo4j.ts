
import neo4j, { Driver } from "neo4j-driver";

let driver: Driver | undefined;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      throw new Error(
        "Missing Neo4j credentials. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD in your .env.local"
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      disableLosslessIntegers: true,
    });
  }
  return driver;
}

export async function verifyNeo4jConnection(): Promise<boolean> {
  const d = getNeo4jDriver();
  try {
    await d.verifyConnectivity();
    return true;
  } catch (err) {
    console.error("Neo4j connection failed:", err);
    return false;
  }
}
