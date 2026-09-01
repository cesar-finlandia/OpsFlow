import type { ToolName, ToolOutcome } from "src/engine/types.ts";

let policyDeniedFlag = false;

export function markPolicyDenied(): void {
  policyDeniedFlag = true;
}

function originIsolatedFlag(): boolean {
  try {
    const v = (globalThis as unknown as { originAgentCluster?: boolean }).originAgentCluster;
    if (typeof v === "boolean") return v;
    const w = typeof window !== "undefined" ? (window as unknown as { originAgentCluster?: boolean }).originAgentCluster : undefined;
    if (typeof w === "boolean") return w;
    return false;
  } catch {
    return false;
  }
}

export function probeWebMcp(): { available: boolean; reason: "ok" | "no-model-context" | "not-origin-isolated" | "policy-denied"; originIsolated: boolean } {
  if (typeof document === "undefined") return { available: false, reason: "no-model-context", originIsolated: false };
  const hasMC = ((): boolean => {
    try {
      return typeof (document as unknown as { modelContext?: unknown }).modelContext !== "undefined" && (document as unknown as { modelContext?: unknown }).modelContext != null;
    } catch {
      return false;
    }
  })();
  if (!hasMC) return { available: false, reason: "no-model-context", originIsolated: originIsolatedFlag() };
  const oi = originIsolatedFlag();
  if (oi === false) return { available: false, reason: "not-origin-isolated", originIsolated: false };
  if (policyDeniedFlag) return { available: false, reason: "policy-denied", originIsolated: oi };
  return { available: true, reason: "ok", originIsolated: oi };
}

export async function executeToolCompat(name: ToolName, args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<ToolOutcome<unknown>> {
  const probe = probeWebMcp();
  if (probe.available) {
    try {
      const res = await (document as unknown as { modelContext: { executeTool: (n: string, a: unknown, o?: unknown) => Promise<unknown> } }).modelContext.executeTool(name, args, options as unknown);
      if (res && typeof res === "object" && "structuredContent" in (res as Record<string, unknown>)) {
        return (res as { structuredContent: ToolOutcome<unknown> }).structuredContent;
      }
      if (res && typeof res === "object" && "ok" in (res as Record<string, unknown>)) {
        return res as unknown as ToolOutcome<unknown>;
      }
      return res as unknown as ToolOutcome<unknown>;
    } catch {
      const { runTool } = await import("./runTool.ts");
      const r = await runTool(name, args, options);
      return r.structuredContent as ToolOutcome<unknown>;
    }
  }
  const { runTool } = await import("./runTool.ts");
  const r = await runTool(name, args, options);
  return r.structuredContent as ToolOutcome<unknown>;
}
