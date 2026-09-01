// UC-03, UC-04, UC-05 | FR-02…FR-06, FR-11, FR-13, FR-14, FR-15
import { test, expect, waitForBoot, runBatch, confirmDialog, agentExecute, timelineEnvelopes, storedHolds, DEMO_GOAL } from "./fixtures/app.ts";

test.describe("UC-03 an external agent chains all five tools", () => {
  test("search → filter → quote → hold → confirm, each returning the WebMCP result shape", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    // 1. search_inventory
    const search = await agentExecute(page, "search_inventory", { query: "blue", limit: 25 });
    expect(search.isError).toBeFalsy();
    expect(search.content[0]!.type).toBe("text");
    expect(search.structuredContent.ok).toBe(true);
    const searchData = (search.structuredContent as { ok: true; data: { matches: Array<{ sku: string; low_stock: boolean; price_cents: number }>; total: number; query_echo: string } }).data;
    expect(searchData.query_echo).toBe("blue");
    expect(searchData.matches.length).toBeGreaterThan(0);
    for (const m of searchData.matches) {
      expect(typeof m.sku).toBe("string");
      expect(typeof m.price_cents).toBe("number");
    }

    // 2. filter_variants narrows the CURRENT result set — the constraint carry-over
    //    that FR-03 exists for.
    const filter = await agentExecute(page, "filter_variants", { options: { color: "Blue" }, maxPriceCents: 1200, maxStock: 5, limit: 25 });
    expect(filter.isError).toBeFalsy();
    const filterData = (filter.structuredContent as { ok: true; data: { matches: Array<{ sku: string }>; total: number; applied: string[]; from_result_set: boolean } }).data;
    expect(filterData.from_result_set, "filter must narrow the previous result set (FR-03)").toBe(true);
    expect(filterData.matches.length).toBeLessThanOrEqual(searchData.matches.length);
    expect(filterData.applied.length).toBeGreaterThan(0);
    const filteredSkus = filterData.matches.map((m) => m.sku);
    expect(filteredSkus.length).toBeGreaterThan(0);

    // 3. calculate_shipping explains every rule it applied (FR-04)
    const quote = await agentExecute(page, "calculate_shipping", {
      items: filteredSkus.slice(0, 3).map((sku) => ({ sku, qty: 1 })),
      zone: 4,
      service: "ground",
    });
    expect(quote.isError).toBeFalsy();
    const quoteData = (quote.structuredContent as { ok: true; data: { zone: number; service: string; total_cents: number; explain: string[]; excluded: unknown[]; surcharges: unknown[] } }).data;
    expect(quoteData.zone).toBe(4);
    expect(quoteData.service).toBe("ground");
    expect(quoteData.total_cents).toBeGreaterThan(0);
    expect(quoteData.explain.length, "quote must explain every rule applied").toBeGreaterThan(0);
    expect(quoteData.explain.length).toBeLessThanOrEqual(12);

    // 4. hold_order requires a human click; grant it.
    const holdPromise = agentExecute(page, "hold_order", {
      lineItems: filteredSkus.slice(0, 3).map((sku) => ({ sku, qty: 1 })),
      ttlMinutes: 15,
      note: "e2e chain",
    });
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Confirm hold_order");
    await page.getByTestId("confirm-action").click();
    const hold = await holdPromise;
    expect(hold.isError).toBeFalsy();
    const holdData = (hold.structuredContent as { ok: true; data: { hold: { hold_id: string; status: string; line_items: unknown[]; expires_at: string }; requires_confirmation: true } }).data;
    expect(holdData.requires_confirmation).toBe(true);
    expect(holdData.hold.hold_id).toMatch(/^HOLD-[A-Z2-7]{8}$/);
    expect(holdData.hold.status).toBe("held");
    expect(holdData.hold.line_items).toHaveLength(3);

    // 5. confirm_fulfillment commits it — also behind a confirmation.
    const confirmPromise = agentExecute(page, "confirm_fulfillment", { holdId: holdData.hold.hold_id });
    await expect(confirmDialog(page)).toBeVisible();
    await page.getByTestId("confirm-action").click();
    const confirmed = await confirmPromise;
    expect(confirmed.isError).toBeFalsy();
    const confirmedData = (confirmed.structuredContent as { ok: true; data: { fulfillment: { fulfillment_id: string; hold_id: string }; hold: { status: string } } }).data;
    expect(confirmedData.fulfillment.fulfillment_id).toMatch(/^FUL-[A-Z2-7]{8}$/);
    expect(confirmedData.fulfillment.hold_id).toBe(holdData.hold.hold_id);
    expect(confirmedData.hold.status).toBe("confirmed");

    // Every step is on the co-execution timeline (FR-14).
    const envelopes = await timelineEnvelopes(page);
    for (const step of ["tool.search_inventory", "tool.filter_variants", "tool.calculate_shipping", "tool.hold_order", "tool.confirm_fulfillment"]) {
      expect(envelopes.some((e) => e.step_id === step && e.status === "started"), `${step} started`).toBe(true);
      expect(envelopes.some((e) => e.step_id === step && e.status === "done"), `${step} done`).toBe(true);
    }
  });
});

test.describe("UC-04 the in-page console runs the demo goal end to end", () => {
  test("plans, executes, gates the hold on a click, and meters the batch", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await runBatch(page, DEMO_GOAL);

    // The confirmation dialog must show the ARGUMENTS THAT WILL EXECUTE — a plan
    // leaves lineItems empty and the tool layer resolves them from the result
    // set; showing "0 SKUs" here would be a lie to the human approving it.
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog).toContainText("Confirm hold_order");
    const dialogText = await dialog.innerText();
    const holdCount = Number(/Hold (\d+) SKU\(s\)/.exec(dialogText)?.[1] ?? "0");
    expect(holdCount, "hold must carry the variants the batch actually matched").toBeGreaterThan(0);
    expect(dialogText).toMatch(/"sku": "OPS-/);

    await page.getByTestId("confirm-action").click();

    // The batch produced a real hold.
    await expect.poll(async () => (await storedHolds(page)).length, { timeout: 15_000 }).toBeGreaterThan(0);

    // Timeline: the plan, then a pair per tool step (FR-14).
    const envelopes = await timelineEnvelopes(page);
    const planStarted = envelopes.find((e) => e.step_id === "agent.plan" && e.status === "started");
    const planDone = envelopes.find((e) => e.step_id === "agent.plan" && e.status === "done");
    expect(planStarted?.payload["goal"]).toBe(DEMO_GOAL);
    expect(["deterministic", "gemini-2.5-flash"]).toContain(planDone?.payload["planner"]);
    expect(Array.isArray(planDone?.payload["steps"])).toBe(true);

    // Savings meter counts what actually happened, against data/baseline.json (FR-15).
    const meterText = await page.locator(".opsflow-meter").innerText();
    const toolCalls = Number(/(\d+) tool calls/.exec(meterText)?.[1] ?? "0");
    const confirmations = Number(/(\d+) confirmation/.exec(meterText)?.[1] ?? "0");
    const actualStarts = envelopes.filter((e) => e.step_id.startsWith("tool.") && e.status === "started").length;
    expect(toolCalls).toBe(actualStarts);
    expect(confirmations).toBe(1);
    expect(meterText).toContain("25 min");
    expect(meterText).toContain("120 clicks");

    // The Batch screen shows the matched variants.
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.locator("tbody td").first()).toContainText("OPS-");
  });

  test("the results table marks low stock and the synthetic-data badge is visible", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await expect(page.getByLabel("synthetic data badge")).toContainText("Synthetic data");

    await runBatch(page, "search blue variants");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });
    const rows = await page.locator("tbody tr").count();
    expect(rows).toBeGreaterThan(0);
  });
});

test.describe("UC-05 nothing commits without a human click", () => {
  test("Cancel refuses the hold with NEEDS_CONFIRMATION and writes no state", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await agentExecute(page, "search_inventory", { query: "blue", limit: 10 });

    const holdPromise = agentExecute(page, "hold_order", { lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }], ttlMinutes: 15 });
    await expect(confirmDialog(page)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    const result = await holdPromise;
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { ok: false; error: { code: string } }).error.code).toBe("NEEDS_CONFIRMATION");
    expect(await storedHolds(page)).toHaveLength(0);

    const envelopes = await timelineEnvelopes(page);
    const confirmDone = envelopes.filter((e) => e.step_id === "session.confirm" && e.status === "done").pop();
    expect(confirmDone?.payload["granted"]).toBe(false);
  });

  test("Escape also refuses, and restores focus", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    const holdPromise = agentExecute(page, "hold_order", { lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }], ttlMinutes: 15 });
    await expect(confirmDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");

    const result = await holdPromise;
    expect((result.structuredContent as { ok: false; error: { code: string } }).error.code).toBe("NEEDS_CONFIRMATION");
    await expect(confirmDialog(page)).toBeHidden();
    expect(await storedHolds(page)).toHaveLength(0);
  });
});
