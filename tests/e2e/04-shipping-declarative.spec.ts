// UC-08 | FR-04, FR-13, MAN-02
import { test, expect, waitForBoot, agentExecute } from "./fixtures/app.ts";

test.describe("UC-08 shipping screen and the declarative WebMCP form", () => {
  test.beforeEach(async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await page.getByRole("tab", { name: "Shipping" }).click();
  });

  test("the form carries the declarative annotations MAN-02 requires", async ({ webmcpPage: page }) => {
    const form = page.locator("form[toolname]");
    await expect(form).toBeVisible();
    // MAN-02 is proven by the DOM a WebMCP-aware agent reads, not by the README.
    await expect(form).toHaveAttribute("toolname", "calculate_shipping");

    // Every input the agent would have to fill carries a description.
    for (const name of ["zone", "service", "skus"]) {
      const field = form.locator(`[name="${name}"]`);
      await expect(field, `${name} field`).toBeVisible();
      const description = await field.getAttribute("tooldescription");
      expect(description, `${name} tooldescription`).toBeTruthy();
      expect((description ?? "").length).toBeGreaterThan(10);
    }
  });

  test("submitting the form produces a quote card with the full explain breakdown", async ({ webmcpPage: page }) => {
    const form = page.locator("form[toolname]");
    await form.locator('[name="skus"]').fill("OPS-1002-BLU-M, OPS-1005-BLU-M");
    await form.locator('[name="zone"]').selectOption("4");
    await form.locator('[name="service"]').selectOption("expedited");
    await form.getByRole("button", { name: /Calculate shipping/ }).click();

    const quote = page.locator(".opsflow-quote");
    await expect(quote).toBeVisible({ timeout: 15_000 });
    await expect(quote).toContainText("Zone 4");
    await expect(quote).toContainText("expedited");
    await expect(quote).toContainText(/\$\d+\.\d{2}/);
    await expect(quote).toContainText(/\d+ g/);

    // FR-04: the breakdown names every rule applied.
    const toggle = quote.getByRole("button", { name: /Show breakdown/ });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(quote.locator("ol li").first()).toBeVisible();
    expect(await quote.locator("ol li").count()).toBeGreaterThan(0);
  });

  test("the quote names every excluded variant with a reason", async ({ webmcpPage: page }) => {
    // A SKU that does not exist in the synthetic catalog must be reported as
    // excluded with a reason, not silently dropped from the total (FR-04).
    const result = await agentExecute(page, "calculate_shipping", {
      items: [{ sku: "OPS-1002-BLU-M", qty: 1 }, { sku: "OPS-9999-ZZZ-XL", qty: 2 }],
      zone: 3,
      service: "ground",
    });
    expect(result.isError).toBeFalsy();
    const data = (result.structuredContent as { ok: true; data: { excluded: Array<{ sku: string; reason: string }>; explain: string[] } }).data;
    expect(data.excluded.map((e) => e.sku)).toContain("OPS-9999-ZZZ-XL");
    expect(data.excluded.find((e) => e.sku === "OPS-9999-ZZZ-XL")?.reason).toBeTruthy();
  });

  test("every surcharge label describes the quote it appears on", async ({ webmcpPage: page }) => {
    // DP-DOM applies REMOTE for zone >= 4 while DP-SEED's label said "(zone 5)",
    // so a zone-4 quote displayed a surcharge that named a different zone. The
    // rule is the one the code, the unit test and the demo goal all use; the
    // label was corrected to match it. A judge reads these lines out loud.
    const result = await agentExecute(page, "calculate_shipping", {
      items: [{ sku: "OPS-1002-BLU-M", qty: 1 }],
      zone: 4,
      service: "ground",
    });
    const data = (result.structuredContent as { ok: true; data: { zone: number; surcharges: Array<{ code: string; label: string }>; explain: string[] } }).data;
    const remote = data.surcharges.find((s) => s.code === "REMOTE");
    expect(remote, "zone 4 is remote per DP-DOM").toBeTruthy();
    for (const line of [remote!.label, ...data.explain]) {
      // No surcharge text may name a zone other than the one being quoted.
      const namedZones = [...line.matchAll(/zones?\s*(\d)(?:\s*[-–]\s*(\d))?/gi)].flatMap((m) => [m[1], m[2]]).filter(Boolean).map(Number);
      if (namedZones.length === 0) continue;
      const min = Math.min(...namedZones);
      const max = Math.max(...namedZones);
      expect(data.zone, `"${line}" does not describe zone ${data.zone}`).toBeGreaterThanOrEqual(min);
      expect(data.zone, `"${line}" does not describe zone ${data.zone}`).toBeLessThanOrEqual(max);
    }
  });

  test("zone and service changes move the total (the rate table is real)", async ({ webmcpPage: page }) => {
    const items = [{ sku: "OPS-1002-BLU-M", qty: 2 }];
    const ground = await agentExecute(page, "calculate_shipping", { items, zone: 1, service: "ground" });
    const overnight = await agentExecute(page, "calculate_shipping", { items, zone: 5, service: "overnight" });
    const g = (ground.structuredContent as { ok: true; data: { total_cents: number } }).data.total_cents;
    const o = (overnight.structuredContent as { ok: true; data: { total_cents: number } }).data.total_cents;
    expect(o).toBeGreaterThan(g);
  });
});
