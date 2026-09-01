import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as session from "src/ui/state/session.ts";

vi.mock("src/agent/orchestrator.ts", () => ({
  orchestrator: { run: vi.fn(async () => ({ plan: { steps: [] }, results: [], traceId: "test" })) }
}));
vi.mock("src/ui/state/session.ts", async () => {
  const actual = await vi.importActual<typeof session>("src/ui/state/session.ts");
  return { ...actual, useSession: vi.fn() };
});
import { BatchScreen } from "src/ui/screens/BatchScreen.tsx";
import { orchestrator } from "src/agent/orchestrator.ts";

const mockUseSession = vi.mocked(session.useSession);

function makeMatches(n: number, lowStockIndices: number[] = [0]) {
  return Array.from({ length: n }, (_, i) => ({
    sku: `SKU-${String(i).padStart(4,"0")}`,
    title: `Title ${i}`,
    options: { size: "M", color: "Blue" },
    price_cents: 1140 + i*10,
    stock: i===0 ? 2 : 10,
    low_stock: lowStockIndices.includes(i),
  }));
}

describe("batch W3", () => {
  beforeEach(() => vi.clearAllMocks());
  it("empty state before run", () => {
    mockUseSession.mockReturnValue({ envelopes: [], degraded: false, holds: [], meter: { tool_calls:0, confirmations:0, elapsed_ms:0, baseline_minutes:25, baseline_clicks:120 }, lastQuote: null, resultSkus: [] });
    render(<BatchScreen />);
    expect(screen.getByPlaceholderText(/e\.g\. hold all low-stock/)).toBeTruthy();
    expect(screen.getByText(/Enter a goal above/)).toBeTruthy();
  });
  it("table rows after faked orchestrator emits search_inventory done", async () => {
    const matches = makeMatches(2, [0]);
    const envelopes: any[] = [{
      step_id: "tool.search_inventory",
      status: "done",
      payload: { outcome: { ok: true, data: { matches, total: 2, truncated: false, query_echo: "blue" } } },
      timestamp: new Date().toISOString(),
      sequence: 1,
    }];
    mockUseSession.mockReturnValue({ envelopes, degraded: false, holds: [], meter: { tool_calls:1, confirmations:0, elapsed_ms:1000, baseline_minutes:25, baseline_clicks:120 }, lastQuote: null, resultSkus: matches.map(m=>m.sku) });
    render(<BatchScreen />);
    expect(screen.getByText("SKU-0000")).toBeTruthy();
    expect(screen.getByText("$11.40")).toBeTruthy();
    expect(screen.getByText("Title 0")).toBeTruthy();
  });
  it("low_stock chip", () => {
    const matches = makeMatches(1, [0]);
    const envelopes: any[] = [{
      step_id: "tool.search_inventory", status:"done", payload:{ outcome:{ ok:true, data:{ matches, total:1, truncated:false, query_echo:"blue" } } }, timestamp: new Date().toISOString(), sequence:1,
    }];
    mockUseSession.mockReturnValue({ envelopes, degraded:false, holds:[], meter: { tool_calls:1, confirmations:0, elapsed_ms:1000, baseline_minutes:25, baseline_clicks:120 }, lastQuote:null, resultSkus: matches.map(m=>m.sku) });
    const { container } = render(<BatchScreen />);
    expect(container.textContent).toContain("low stock");
  });
  it("checkbox count", async () => {
    const matches = makeMatches(2);
    const envelopes: any[] = [{
      step_id: "tool.search_inventory", status:"done", payload:{ outcome:{ ok:true, data:{ matches, total:2, truncated:false, query_echo:"blue" } } }, timestamp: new Date().toISOString(), sequence:1,
    }];
    mockUseSession.mockReturnValue({ envelopes, degraded:false, holds:[], meter: { tool_calls:1, confirmations:0, elapsed_ms:1000, baseline_minutes:25, baseline_clicks:120 }, lastQuote:null, resultSkus: matches.map(m=>m.sku) });
    render(<BatchScreen />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.length).toBe(2);
    fireEvent.click(boxes[0]);
    expect(screen.getByText("1 selected — quote on Shipping tab")).toBeTruthy();
    fireEvent.click(boxes[1]);
    expect(screen.getByText("2 selected — quote on Shipping tab")).toBeTruthy();
  });
  it("caps at 50", async () => {
    const matches = makeMatches(60);
    const envelopes: any[] = [{
      step_id: "tool.search_inventory", status:"done", payload:{ outcome:{ ok:true, data:{ matches, total:60, truncated:false, query_echo:"blue" } } }, timestamp: new Date().toISOString(), sequence:1,
    }];
    mockUseSession.mockReturnValue({ envelopes, degraded:false, holds:[], meter: { tool_calls:1, confirmations:0, elapsed_ms:1000, baseline_minutes:25, baseline_clicks:120 }, lastQuote:null, resultSkus: matches.map(m=>m.sku) });
    render(<BatchScreen />);
    const boxes = screen.getAllByRole("checkbox");
    for (let i=0;i<50;i++) fireEvent.click(boxes[i]);
    expect(screen.getByText("50 selected — quote on Shipping tab")).toBeTruthy();
    fireEvent.click(boxes[50]);
    expect(screen.getByText("Selection capped at 50 SKUs — deselect some to add others")).toBeTruthy();
    expect(screen.getByText("50 selected — quote on Shipping tab")).toBeTruthy();
  });
  it("run button calls orchestrator", async () => {
    mockUseSession.mockReturnValue({ envelopes: [], degraded:false, holds:[], meter: { tool_calls:0, confirmations:0, elapsed_ms:0, baseline_minutes:25, baseline_clicks:120 }, lastQuote:null, resultSkus: [] });
    render(<BatchScreen />);
    const input = screen.getByPlaceholderText(/e\.g\. hold all low-stock/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hold all low-stock blue variants" } });
    const btn = screen.getByText("Run with agent");
    fireEvent.click(btn);
    await new Promise(r=>setTimeout(r,10));
    expect(vi.mocked(orchestrator.run)).toHaveBeenCalledWith("hold all low-stock blue variants");
  });
});
