// Requirement IDs: FR-07, FR-08, NFR-09 | E2E strategy §2.2
// Shared Playwright fixtures and page helpers for the OpsFlow E2E suite.

import { test as base, expect, type Page } from "@playwright/test";
import { WEBMCP_HOST_SCRIPT } from "./webmcp-host.ts";

export const DEMO_GOAL = "hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes";
export const TOOL_NAMES = [
  "search_inventory",
  "filter_variants",
  "calculate_shipping",
  "hold_order",
  "confirm_fulfillment",
] as const;

export interface AppFixtures {
  /** A page with the WebMCP host installed — simulates an agent-capable browser. */
  webmcpPage: Page;
  /** A page WITHOUT the host — the FR-17 fallback a judge on a plain browser gets. */
  plainPage: Page;
}

// Tests that deliberately break the network opt in here. Everything else keeps
// the strict guard, which is what caught the chassis event-stream hook retrying
// a non-existent `/events` endpoint on every page load.
const resourceErrorsAllowed = new WeakSet<Page>();

/**
 * Declare that this test intentionally makes requests fail (blocked routes, or
 * a server with no API), so the browser's own "Failed to load resource" console
 * entries are not treated as application defects.
 */
export function allowResourceErrors(page: Page): void {
  resourceErrorsAllowed.add(page);
}

/** True for console noise the *browser* emits about a request that did not complete. */
function isResourceLoadError(text: string): boolean {
  return text.includes("Failed to load resource") || text.includes("net::ERR_");
}

/** Collected uncaught page errors; a non-empty list fails the test. */
function guardConsole(page: Page, sink: string[]): void {
  // An uncaught exception or rejection is always a defect — FR-07/FR-08 promise
  // `execute` never throws — and is never excused by allowResourceErrors().
  page.on("pageerror", (err) => sink.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (resourceErrorsAllowed.has(page) && isResourceLoadError(text)) return;
    sink.push(`console.error: ${text}`);
  });
}

export const test = base.extend<AppFixtures>({
  webmcpPage: async ({ page }, use) => {
    const errors: string[] = [];
    guardConsole(page, errors);
    await page.addInitScript(WEBMCP_HOST_SCRIPT);
    // No storage clearing here: Playwright gives every test a fresh browser
    // context, so localStorage already starts empty. An addInitScript that wiped
    // it would also fire on page.reload(), silently defeating the tests that
    // assert holds survive a reload (§2.6 client-owned state).
    await use(page);
    // FR-07/FR-08 promise `execute` never throws. Make that falsifiable.
    expect(errors, "page logged uncaught errors").toEqual([]);
  },

  plainPage: async ({ page }, use) => {
    const errors: string[] = [];
    guardConsole(page, errors);
    await use(page);
    expect(errors, "page logged uncaught errors").toEqual([]);
  },
});

export { expect };

/** The WebMCP result shape returned by every tool (§2.5). */
export interface WebMcpResult {
  content: Array<{ type: string; text: string }>;
  structuredContent: { ok: true; data: Record<string, unknown>; degraded?: boolean } | { ok: false; error: { code: string; message: string; details?: unknown } };
  isError?: boolean;
}

/**
 * Call a tool the way an external agent does — through the page's own
 * `document.modelContext.executeTool`. Never bypasses registration.
 */
export async function agentExecute(page: Page, name: string, args: unknown, opts?: { abort?: boolean }): Promise<WebMcpResult> {
  return page.evaluate(
    async ({ name, args, abort }) => {
      const options: { signal?: AbortSignal } = {};
      if (abort) {
        const ctrl = new AbortController();
        ctrl.abort();
        options.signal = ctrl.signal;
      }
      const mc = (document as unknown as { modelContext: { executeTool: (n: string, a: unknown, o?: unknown) => Promise<unknown> } }).modelContext;
      return (await mc.executeTool(name, args, options)) as unknown;
    },
    { name, args, abort: opts?.abort ?? false },
  ) as Promise<WebMcpResult>;
}

/** Wait until the five tools are registered and the console has rendered. */
export async function waitForBoot(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "OpsFlow", level: 1 })).toBeVisible();
  await page.waitForFunction(() => {
    const order = (window as unknown as { __opsflowBootOrder?: string[] }).__opsflowBootOrder;
    return Array.isArray(order) && order.includes("render");
  });
}

/** Type the goal and start the batch; resolves once the run is under way. */
export async function runBatch(page: Page, goal: string): Promise<void> {
  await page.getByTestId("goal-input").fill(goal);
  await page.getByRole("button", { name: "Run batch" }).click();
}

/** The confirmation dialog the state-changing tools stop at (FR-05/FR-06). */
export function confirmDialog(page: Page) {
  return page.getByRole("dialog");
}

/** All envelopes the session has ingested, read from the page's publisher. */
export async function timelineEnvelopes(page: Page): Promise<Array<{ step_id: string; status: string; payload: Record<string, unknown>; degraded?: boolean }>> {
  return page.evaluate(() => {
    const pub = (globalThis as unknown as { __opsflow_publisher?: { collect: (id?: string) => { events: unknown[] } | null } }).__opsflow_publisher;
    const snap = pub?.collect?.();
    return (snap?.events ?? []) as Array<{ step_id: string; status: string; payload: Record<string, unknown>; degraded?: boolean }>;
  });
}

/** Holds currently in the client-owned store. */
export async function storedHolds(page: Page): Promise<Array<{ hold_id: string; status: string; line_items: Array<{ sku: string; qty: number }> }>> {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("opsflow.holds.v1");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as { holds?: unknown[] }).holds)) {
        return (parsed as { holds: unknown[] }).holds;
      }
      return [];
    } catch {
      return [];
    }
  }) as Promise<Array<{ hold_id: string; status: string; line_items: Array<{ sku: string; qty: number }> }>>;
}
