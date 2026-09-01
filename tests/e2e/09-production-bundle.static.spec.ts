// UC-13 | NFR-01, NFR-11, NFR-12, MAN-05, §5.2 rung 3
// Runs against `vite preview` serving dist/ — the exact bundle a judge downloads,
// with no API behind it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, waitForBoot, runBatch, confirmDialog, agentExecute, storedHolds, allowResourceErrors, TOOL_NAMES, DEMO_GOAL } from "./fixtures/app.ts";

test.describe("UC-13 the production bundle is the thing that works", () => {
  // `vite preview` serves dist/ with no API behind it — that is the point of
  // this project (§5.2 rung 3), so blocked/404 API requests are expected here.
  test.beforeEach(({ webmcpPage: page }) => allowResourceErrors(page));

  test("the built page boots and registers five tools", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await expect(page).toHaveTitle(/OpsFlow/);

    const names = await page.evaluate(() =>
      (document as unknown as { modelContext: { getTools: () => Array<{ name: string }> } }).modelContext.getTools().map((t) => t.name),
    );
    expect(names.sort()).toEqual([...TOOL_NAMES].sort());
  });

  test("the console is styled, not raw HTML", async ({ webmcpPage: page }) => {
    // A stylesheet that fails to ship is invisible to the dev server and fatal
    // to the Execution axis, so assert an actual computed style.
    await page.goto("/");
    await waitForBoot(page);
    const styled = await page.evaluate(() => {
      const el = document.querySelector(".opsflow");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { maxWidth: cs.maxWidth, display: cs.display, bodyBg: getComputedStyle(document.body).backgroundColor };
    });
    expect(styled, ".opsflow root must exist in the built page").not.toBeNull();
    expect(styled!.display).toBe("flex");
    expect(styled!.maxWidth).not.toBe("none");
    expect(styled!.bodyBg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("the whole flow completes from local data with a visible degraded state", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    const search = await agentExecute(page, "search_inventory", { query: "blue", limit: 25 });
    expect(search.isError).toBeFalsy();
    expect((search.structuredContent as { ok: true; data: { matches: unknown[] } }).data.matches.length).toBeGreaterThan(0);

    await runBatch(page, DEMO_GOAL);
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible({ timeout: 25_000 });
    const holdCount = Number(/Hold (\d+) SKU\(s\)/.exec(await dialog.innerText())?.[1] ?? "0");
    expect(holdCount).toBeGreaterThan(0);
    await page.getByTestId("confirm-action").click();

    await expect.poll(async () => (await storedHolds(page)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    // No API is served here, so the app must be honest about it (§5.2).
    await expect(page.locator(".opsflow-banner--degraded")).toBeVisible();
  });

  test("renders no iframe anywhere (NFR-12)", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    for (const tab of ["Batch", "Shipping", "Holds"]) {
      await page.getByRole("tab", { name: tab }).click();
      expect(await page.locator("iframe").count(), tab).toBe(0);
    }
  });

  test("the built bundle contains no credential-shaped string (NFR-01)", async () => {
    const assetsDir = join(process.cwd(), "dist", "assets");
    const files = readdirSync(assetsDir).filter((f) => f.endsWith(".js") || f.endsWith(".css"));
    expect(files.length).toBeGreaterThan(0);

    // Patterns for the credentials this app could plausibly leak: a Google API
    // key, a Vercel token, a PEM private key, and the service-account envelope.
    const forbidden: Array<[string, RegExp]> = [
      ["Google API key", /AIza[0-9A-Za-z_-]{10,}/],
      ["Vercel token", /VERCEL_TOKEN\s*[:=]\s*["'][^"']+["']/],
      ["PEM private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
      ["service-account JSON", /"type"\s*:\s*"service_account"/],
      ["bearer literal", /Bearer\s+ya29\./],
    ];

    for (const file of files) {
      const content = readFileSync(join(assetsDir, file), "utf8");
      for (const [label, pattern] of forbidden) {
        expect(pattern.test(content), `${file} contains a ${label}`).toBe(false);
      }
      // The env var names themselves must not be inlined into client code either.
      expect(content.includes("GOOGLE_VERTEX_CREDENTIALS"), `${file} references GOOGLE_VERTEX_CREDENTIALS`).toBe(false);
    }
  });
});
