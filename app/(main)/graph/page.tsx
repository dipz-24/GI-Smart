"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// react-force-graph relies on the browser canvas API, so it can't be
// server-rendered — load it client-side only.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  group: string;
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// One color per node label, matching the app's existing palette.
const GROUP_COLORS: Record<string, string> = {
  Food: "#e05b2b",
  HealthCondition: "#c1440e",
  HealthGoal: "#2d6a4f",
  MealPlan: "#7a5800",
  TrackingDay: "#185fa5",
  User: "#8a4fb5",
};
const DEFAULT_COLOR = "#4a4a3a";

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graph?limit=250");
      if (!res.ok) throw new Error("Failed to load graph data");
      const json = await res.json();
      setData(json);
      setSelectedNodeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 600,
        });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const groups = data ? Array.from(new Set(data.nodes.map((n) => n.group))) : [];
  const focusedNodeIds = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    const ids = new Set<string>([selectedNodeId]);
    for (const link of data.links) {
      const sourceId = typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
      const targetId = typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
      if (sourceId === selectedNodeId) ids.add(targetId);
      if (targetId === selectedNodeId) ids.add(sourceId);
    }
    return ids;
  }, [data, selectedNodeId]);

  const selectedNode = data?.nodes.find((node) => node.id === selectedNodeId);

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1a1a14]">Graph Explorer</h1>
            <p className="text-sm text-[#4a4a3a] mt-1">
              Live view of the Neo4j graph — foods, health goals, meal plans, and how they connect.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchGraph} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {groups.map((g) => (
              <div key={g} className="flex items-center gap-1.5 text-xs font-medium text-[#4a4a3a]">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ background: GROUP_COLORS[g] ?? DEFAULT_COLOR }}
                />
                {g}
              </div>
            ))}
          </div>
        )}

        <Card className="border border-[rgba(26,26,20,0.08)] shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle>Node & Relationship Map</CardTitle>
            <CardDescription>
              {data ? `${data.nodes.length} nodes · ${data.links.length} relationships` : "Loading…"}
              {selectedNode && ` · Focused on ${selectedNode.label} (${focusedNodeIds!.size - 1} direct connections)`}
              {data && !selectedNode && " · Click a node to focus; click the background to reset"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={containerRef} className="w-full bg-white" style={{ height: 600 }}>
              {loading && (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={28} className="animate-spin text-[#e05b2b]" />
                </div>
              )}
              {error && (
                <div className="w-full h-full flex items-center justify-center text-sm text-[#c1440e] px-6 text-center">
                  {error}. Confirm your Neo4j credentials are set in <code>.env.local</code> and the instance is running.
                </div>
              )}
              {!loading && !error && data && (
                <ForceGraph2D
                  graphData={data}
                  width={dimensions.width}
                  height={dimensions.height}
                  nodeId="id"
                  nodeLabel="label"
                  nodeColor={(node: any) => {
                    if (!focusedNodeIds || focusedNodeIds.has(node.id)) {
                      return GROUP_COLORS[node.group] ?? DEFAULT_COLOR;
                    }
                    return "rgba(154,154,138,0.16)";
                  }}
                  nodeVal={(node: any) => node.id === selectedNodeId ? 3 : 1}
                  nodeRelSize={5}
                  linkLabel="type"
                  linkColor={(link: any) => {
                    if (!selectedNodeId) return "rgba(26,26,20,0.25)";
                    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                    const targetId = typeof link.target === "object" ? link.target.id : link.target;
                    return sourceId === selectedNodeId || targetId === selectedNodeId
                      ? "rgba(224,91,43,0.9)"
                      : "rgba(154,154,138,0.08)";
                  }}
                  linkWidth={(link: any) => {
                    if (!selectedNodeId) return 1;
                    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                    const targetId = typeof link.target === "object" ? link.target.id : link.target;
                    return sourceId === selectedNodeId || targetId === selectedNodeId ? 2.5 : 0.5;
                  }}
                  linkDirectionalArrowLength={(link: any) => {
                    if (!selectedNodeId) return 4;
                    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                    const targetId = typeof link.target === "object" ? link.target.id : link.target;
                    return sourceId === selectedNodeId || targetId === selectedNodeId ? 5 : 0;
                  }}
                  linkDirectionalArrowRelPos={1}
                  onNodeClick={(node: any) => setSelectedNodeId(node.id)}
                  onBackgroundClick={() => setSelectedNodeId(null)}
                  onNodeHover={(node: any) => {
                    if (containerRef.current) {
                      containerRef.current.style.cursor = node ? "pointer" : "default";
                    }
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
