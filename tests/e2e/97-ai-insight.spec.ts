import { test, expect, waitForBoot } from "./fixtures/app.ts";

test("meta question shows AI insight with model, not No variants", async ({ webmcpPage: page }) => {
  await page.goto("/");
  await waitForBoot(page);
  const input = page.getByTestId("goal-input");
  await input.fill("which ai model are you?");
  await input.press("Enter");
  // AI insight box should show model info
  const insight = page.getByTestId("ai-insight-box");
  await expect(insight).toBeVisible({ timeout: 10000 });
  await expect(insight).toContainText("Gemini", { ignoreCase: true });
  await expect(insight).toContainText("2.5");
  // Should NOT show No variants matched (suppressed for meta)
  await expect(page.getByText("No variants matched")).not.toBeVisible();
  // Main box title should be visible
  await expect(page.getByText("Batch Task — Fulfillment Goal")).toBeVisible();
});

test("what kind of products shows catalog, not No variants", async ({ webmcpPage: page }) => {
  await page.goto("/");
  await waitForBoot(page);
  await page.getByTestId("goal-input").fill("what kind of products are in this catalog?");
  await page.getByTestId("goal-input").press("Enter");
  await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".opsflow-count").first()).toContainText("25 variants");
  await expect(page.getByTestId("ai-insight-box")).toContainText("Agent Insight");
});
