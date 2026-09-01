import { TOOL_SCHEMAS, TOOL_DESCRIPTIONS, TOOL_ANNOTATIONS } from "./schemas.ts";
import { runTool } from "./runTool.ts";
import { probeWebMcp, markPolicyDenied } from "./policy.ts";
import type { ToolName } from "src/engine/types.ts";

let registered = false;
let cached: { registered: ToolName[]; available: boolean; reason: string | null } | null = null;

const ORDER: ToolName[] = ["search_inventory", "filter_variants", "calculate_shipping", "hold_order", "confirm_fulfillment"];

export async function registerAllTools(): Promise<{ registered: ToolName[]; available: boolean; reason: string | null }> {
  const probe = probeWebMcp();
  if (!probe.available) {
    const r = { registered: [] as ToolName[], available: false as const, reason: probe.reason };
    cached = r;
    return r;
  }
  if (registered && cached) return cached;
  const done: ToolName[] = [];
  for (const name of ORDER) {
    try {
      await (document as unknown as { modelContext: { registerTool: (o: unknown) => Promise<void> } }).modelContext.registerTool({
        name,
        description: TOOL_DESCRIPTIONS[name],
        inputSchema: TOOL_SCHEMAS[name] as unknown as Record<string, unknown>,
        annotations: TOOL_ANNOTATIONS[name] as unknown as Record<string, unknown>,
        execute: async (input: unknown, options?: { signal?: AbortSignal }) => runTool(name, input, options),
      });
      done.push(name);
    } catch (e: unknown) {
      const msg = String((e as Error)?.message ?? e);
      if (/already registered|duplicate/i.test(msg)) {
        if (!done.includes(name)) done.push(name);
        continue;
      }
      if (/permission|policy|denied|not allowed/i.test(msg)) {
        const r = { registered: done, available: false as const, reason: "policy-denied" };
        cached = r;
        markPolicyDenied();
        return r;
      }
      throw e;
    }
  }
  registered = true;
  cached = { registered: done, available: true, reason: null };
  return cached;
}
