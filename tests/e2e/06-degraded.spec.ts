// UC-10 | FR-18, NFR-03, §5.2 fallback ladder rungs 3–5
import { test, expect, waitForBoot, runBatch, confirmDialog, agentExecute, timelineEnvelopes, storedHolds, allowResourceErrors, DEMO_GOAL } from "./fixtures/app.ts";

test.describe("UC-10 degraded operation is complete and visible", () => {
  // Every case here severs the network on purpose; the browser logs a resource
  // error for each blocked request. Uncaught exceptions still fail the test.
  test.beforeEach(({ webmcpPage: page }) => allowResourceErrors(page));

  test("with the API unreachable, the full chain still completes from local data", async ({ webmcpPage: page }) => {
    // Rung 3: "API routes unreachable" — the tools must compute in-browser from
    // data/catalog.json and say so, not blank the screen (FR-18).
    await page.route("**/api/**", (route) => route.abort("connectionrefused"));
    await page.goto("/");
    await waitForBoot(page);

    const search = await agentExecute(page, "search_inventory", { query: "blue", limit: 25 });
    expect(search.isError, "read-only tools must not fail when the network does").toBeFalsy();
    const data = (search.structuredContent as { ok: true; data: { matches: Array<{ sku: string }> }; degraded?: boolean }).data;
    expect(data.matches.length, "local catalog must return real data, not a placeholder").toBeGreaterThan(0);
    expect(data.matches[0]!.sku).toMatch(/^OPS-/);

    // The degradation is on the envelope, not hidden.
    const envelopes = await timelineEnvelopes(page);
    const done = envelopes.find((e) => e.step_id === "tool.search_inventory" && e.status === "done");
    expect(done?.degraded, "degraded steps must be marked on the envelope").toBe(true);

    // And it is on screen.
    await expect(page.locator(".opsflow-banner--degraded")).toBeVisible();
  });

  test("the degraded path returns the same data the live path returned", async ({ webmcpPage: page }) => {
    // Correctness is the point of the fallback: cached/local, but not wrong.
    await page.goto("/");
    await waitForBoot(page);
    const live = await agentExecute(page, "search_inventory", { query: "blue", limit: 10 });
    const liveSkus = (live.structuredContent as { ok: true; data: { matches: Array<{ sku: string }> } }).data.matches.map((m) => m.sku);

    await page.route("**/api/**", (route) => route.abort("connectionrefused"));
    await page.reload();
    await waitForBoot(page);
    const degraded = await agentExecute(page, "search_inventory", { query: "blue", limit: 10 });
    const degradedSkus = (degraded.structuredContent as { ok: true; data: { matches: Array<{ sku: string }> } }).data.matches.map((m) => m.sku);

    expect(degradedSkus).toEqual(liveSkus);
  });

  test("the whole demo goal completes offline, hold included (NFR-03)", async ({ webmcpPage: page }) => {
    await page.route("**/api/**", (route) => route.abort("connectionrefused"));
    await page.goto("/");
    await waitForBoot(page);

    await runBatch(page, DEMO_GOAL);

    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible({ timeout: 25_000 });
    const holdCount = Number(/Hold (\d+) SKU\(s\)/.exec(await dialog.innerText())?.[1] ?? "0");
    expect(holdCount, "the offline chain must still hold real variants").toBeGreaterThan(0);
    await page.getByTestId("confirm-action").click();

    await expect.poll(async () => (await storedHolds(page)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    // Rung entered, and visibly so — never silently.
    await expect(page.locator(".opsflow-banner--degraded")).toBeVisible();
  });

  test("a plan is still produced when the planner route is unreachable (FR-12)", async ({ webmcpPage: page }) => {
    await page.route("**/api/agent/plan", (route) => route.abort("connectionrefused"));
    await page.goto("/");
    await waitForBoot(page);

    await runBatch(page, DEMO_GOAL);
    await expect(confirmDialog(page)).toBeVisible({ timeout: 25_000 });

    const envelopes = await timelineEnvelopes(page);
    const planDone = envelopes.find((e) => e.step_id === "agent.plan" && e.status === "done");
    expect(planDone, "the planner must always produce a plan").toBeTruthy();
    expect(planDone!.payload["planner"], "the UI must say which planner ran").toBe("deterministic");
    expect(Array.isArray(planDone!.payload["steps"])).toBe(true);
    expect((planDone!.payload["steps"] as unknown[]).length).toBeGreaterThan(0);
  });
});
