import { describe, it, expect, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { ToolInspector } from "src/ui/components/ToolInspector.tsx";
import { CoExecutionTimeline } from "src/ui/components/CoExecutionTimeline.tsx";
import { SavingsMeter } from "src/ui/components/SavingsMeter.tsx";
import { TOOL_SCHEMAS } from "src/webmcp/schemas.ts";

const FIVE = [
  { name: "search_inventory", description: "Search the synthetic OpsFlow catalog", inputSchema: TOOL_SCHEMAS.search_inventory, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "filter_variants", description: "Narrow the current OpsFlow result set", inputSchema: TOOL_SCHEMAS.filter_variants, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "calculate_shipping", description: "Quote shipping for a basket", inputSchema: TOOL_SCHEMAS.calculate_shipping, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "hold_order", description: "Create a reversible OpsFlow hold", inputSchema: TOOL_SCHEMAS.hold_order, annotations: { readOnlyHint: false, openWorldHint: false } },
  { name: "confirm_fulfillment", description: "Confirm a held OpsFlow hold", inputSchema: TOOL_SCHEMAS.confirm_fulfillment, annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false } },
];

function setFakeTools(tools: unknown[] | null): void {
  const d = (globalThis as unknown as { document: Record<string, unknown> }).document as unknown as Record<string, unknown>;
  if (tools === null) {
    if (d && typeof d === "object" && "modelContext" in d) delete (d as Record<string, unknown>).modelContext;
    try {
      const doc2 = typeof document !== "undefined" ? (document as unknown as Record<string, unknown>) : null;
      if (doc2 && "modelContext" in doc2) delete doc2.modelContext;
    } catch { /* ignore */ }
  } else {
    const fake = { getTools: () => tools };
    if (d) (d as Record<string, unknown>).modelContext = fake as unknown;
    try {
      if (typeof document !== "undefined") (document as unknown as Record<string, unknown>).modelContext = fake as unknown;
    } catch { /* ignore */ }
  }
}

describe("inspector W6", () => {
  afterEach(() => {
    setFakeTools(null);
    vi.restoreAllMocks();
  });

  it("with faked getTools lists five names", () => {
    setFakeTools(FIVE);
    const { container } = render(<ToolInspector open={true} />);
    expect(container.textContent).toContain("search_inventory");
    expect(container.textContent).toContain("filter_variants");
    expect(container.textContent).toContain("calculate_shipping");
    expect(container.textContent).toContain("hold_order");
    expect(container.textContent).toContain("confirm_fulfillment");
  });

  it("with faked getTools lists descriptions", () => {
    setFakeTools(FIVE);
    const { container } = render(<ToolInspector open={true} />);
    expect(container.textContent).toContain("Search the synthetic OpsFlow catalog");
  });

  it("with faked getTools shows annotations badges", () => {
    setFakeTools(FIVE);
    const { container } = render(<ToolInspector open={true} />);
    expect(container.textContent).toContain("readOnly");
    expect(container.textContent).toContain("confirm-required");
  });

  it("with faked getTools shows schemas", () => {
    setFakeTools(FIVE);
    const { container } = render(<ToolInspector open={true} />);
    expect(container.textContent).toContain("\"query\"");
    expect(container.textContent).toContain("\"holdId\"");
  });

  it("with no modelContext shows fallback note and still lists five from TOOL_SCHEMAS", () => {
    setFakeTools(null);
    const { container } = render(<ToolInspector open={true} />);
    expect(container.textContent).toContain("not registered — showing schema fallback");
    expect(container.textContent).toContain("search_inventory");
    expect(container.textContent).toContain("filter_variants");
    expect(container.textContent).toContain("calculate_shipping");
    expect(container.textContent).toContain("hold_order");
    expect(container.textContent).toContain("confirm_fulfillment");
  });

  it("timeline renders started/done/error rows", () => {
    const now = new Date().toISOString();
    const envelopes: unknown[] = [
      { step_id: "tool.search_inventory", status: "started", payload: { query: "blue" }, timestamp: now, sequence: 1 },
      { step_id: "tool.search_inventory", status: "done", payload: { outcome: { ok: true } }, timestamp: now, sequence: 2 },
      { step_id: "tool.filter_variants", status: "error", payload: { error: "oops" }, timestamp: now, sequence: 3, degraded: true },
    ];
    const { container } = render(<CoExecutionTimeline envelopes={envelopes as never} />);
    expect(container.textContent).toContain("tool.search_inventory");
    expect(container.textContent).toContain("tool.filter_variants");
    expect(container.textContent).toContain("Degraded");
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(container.textContent).toContain("\"query\"");
  });

  it("SavingsMeter matches format", () => {
    const meter = { tool_calls: 3, confirmations: 1, elapsed_ms: 41000, baseline_minutes: 25, baseline_clicks: 120 };
    const { container } = render(<SavingsMeter meter={meter as never} />);
    expect(container.textContent).toContain("3 tool calls");
    expect(container.textContent).toContain("1 confirmation(s)");
    expect(container.textContent).toContain("41s");
    expect(container.textContent).toContain("manual baseline 25 min / 120 clicks");
    expect(container.textContent).toContain("saved ~24 min");
  });
});
