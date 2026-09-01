import * as React from "react";
import { TOOL_SCHEMAS, TOOL_DESCRIPTIONS, TOOL_ANNOTATIONS } from "src/webmcp/schemas.ts";
import type { ToolName } from "src/engine/types.ts";

const FROZEN_ORDER: ToolName[] = ["search_inventory", "filter_variants", "calculate_shipping", "hold_order", "confirm_fulfillment"];

type LiveTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
};

export function ToolInspector({ open }: { open: boolean }): JSX.Element | null {
  if (!open) return null;

  const effectiveLive: LiveTool[] = (() => {
    try {
      const doc: unknown = typeof document !== "undefined" ? (document as unknown) : (globalThis as unknown as { document?: unknown }).document;
      const getter = (doc as { modelContext?: { getTools?: () => unknown[] } })?.modelContext?.getTools;
      if (typeof getter !== "function") return [];
      const res = (getter as () => unknown[])();
      return Array.isArray(res) ? (res as LiveTool[]) : [];
    } catch {
      return [];
    }
  })();

  const useFallback = effectiveLive.length !== 5;

  if (useFallback) {
    return (
      <div data-testid="tool-inspector">
        <p>not registered — showing schema fallback</p>
        {FROZEN_ORDER.slice(0, 5).map((name) => {
          const schema = TOOL_SCHEMAS[name];
          const desc = TOOL_DESCRIPTIONS[name];
          const ann = TOOL_ANNOTATIONS[name] as Record<string, unknown>;
          const badge = ann?.readOnlyHint ? "readOnly" : "confirm-required";
          return (
            <div key={name} data-tool={name}>
              <h4>{name}</h4>
              <p>{desc}</p>
              <span>{badge}</span>
              <pre>{JSON.stringify(schema, null, 2)}</pre>
            </div>
          );
        })}
      </div>
    );
  }

  // live path — sort by frozen order, show at most five
  const byName = new Map<string, LiveTool>();
  for (const t of effectiveLive) {
    if (t && typeof t.name === "string") byName.set(t.name, t);
  }
  const ordered: LiveTool[] = FROZEN_ORDER.map((n) => byName.get(n)).filter(Boolean) as LiveTool[];
  // if some name missing (should not happen when length===5 but handle), fill with remaining in original order
  if (ordered.length !== 5) {
    const remaining = effectiveLive.filter((t) => !FROZEN_ORDER.includes(t.name as ToolName));
    ordered.push(...remaining);
  }
  const display = ordered.slice(0, 5);

  return (
    <div data-testid="tool-inspector">
      {display.map((tool) => {
        const ann = (tool.annotations ?? {}) as Record<string, unknown>;
        const badge = ann.readOnlyHint ? "readOnly" : "confirm-required";
        return (
          <div key={tool.name} data-tool={tool.name}>
            <h4>{tool.name}</h4>
            <p>{tool.description ?? ""}</p>
            <span>{badge}</span>
            <pre>{JSON.stringify(tool.inputSchema ?? {}, null, 2)}</pre>
          </div>
        );
      })}
    </div>
  );
}
