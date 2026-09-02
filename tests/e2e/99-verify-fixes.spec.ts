// Verify fixes for user-reported bugs: Enter key, hold popup details, Batch→Shipping
import { test, expect, waitForBoot, runBatch, confirmDialog, storedHolds } from "./fixtures/app.ts";

test.describe("Verify user fixes", () => {
  test("Enter key triggers batch and button is submit", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    const input = page.getByTestId("goal-input");
    await expect(input).toBeVisible();
    // Check button is type submit and is enabled
    const button = page.getByRole("button", { name: "Run batch" });
    await expect(button).toHaveAttribute("type", "submit");
    // Type goal and press Enter (not clicking)
    await input.fill("hold all the Olive variants under 10 dollars for 15 minutes");
    await input.press("Enter");
    // Should have started - dialog should appear
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog).toContainText("Hold");
    // Dialog should show recognizable product info, not just SKUs
    const text = await dialog.innerText();
    expect(text).toMatch(/Olive|Blue|olive/i);
    expect(text).toMatch(/\$/); // price
    // Should show size/color like "S/Olive" or similar
    expect(text).toMatch(/Size|Color|Olive/i);
    await page.getByTestId("confirm-action").click();
    await expect(dialog).toBeHidden();
    // Verify hold created
    await expect.poll(async () => (await storedHolds(page)).length).toBeGreaterThan(0);
  });

  test("Batch hold Olive under 10 creates 5 olive holds and Shipping shows them", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await runBatch(page, "hold all the Olive variants under 10 dollars for 15 minutes");
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15000 });
    const text = await dialog.innerText();
    // Should contain 5 SKUs and olive details
    expect(text).toMatch(/Hold 5 SKU/);
    expect(text).toMatch(/Olive/);
    // Should contain price like $7.50 etc
    expect(text).toMatch(/\$/);
    await page.getByTestId("confirm-action").click();
    // Check Holds tab has 5 items
    await page.getByRole("tab", { name: "Holds" }).click();
    const holdId = (await storedHolds(page))[0]?.hold_id;
    expect(holdId).toBeTruthy();
    await expect(page.locator("tbody tr", { hasText: holdId! })).toContainText("5 SKUs");
    // Go to Shipping and check effective SKUs
    await page.getByRole("tab", { name: "Shipping" }).click();
    const info = page.getByTestId("effective-skus-info");
    await expect(info).toBeVisible();
    await expect(info).toContainText("5");
    // Should not be hardcoded fallback
    const infoText = await info.innerText();
    expect(infoText).not.toContain("OPS-1042-BLU-M, OPS-1050-RED-S");
    // Shipping panel should show OLI SKUs fully disclosed
    const panel = page.getByTestId("shipping-selected-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("OLI");
    // Input should be prefilled with SKUs, not placeholder
    const input = page.locator('input[name="skus"]');
    const placeholder = await input.getAttribute("placeholder");
    expect(placeholder).toBe(""); // no SKU placeholder when empty
    const inputValue = await input.inputValue();
    expect(inputValue).toContain("OLI");
  });

  test("Manual checkbox selection carries to Shipping", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    // Search all
    await runBatch(page, "search all");
    // Wait for table
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15000 });
    // Get first 2 SKUs
    const rows = page.locator("tbody tr");
    const firstSku = await rows.nth(0).locator("td").first().innerText();
    const secondSku = await rows.nth(1).locator("td").first().innerText();
    // Check 2 boxes
    await rows.nth(0).locator('input[type="checkbox"]').check();
    await rows.nth(1).locator('input[type="checkbox"]').check();
    // Verify count
    await expect(page.locator("text=2 selected")).toBeVisible();
    // Go to Shipping
    await page.getByRole("tab", { name: "Shipping" }).click();
    const info = page.getByTestId("effective-skus-info");
    await expect(info).toContainText("2 selected from Batch");
    // Info no longer contains SKUs, panel does
    const panel = page.getByTestId("shipping-selected-panel");
    await expect(panel).toContainText(firstSku);
    await expect(panel).toContainText(secondSku);
    // Input should be prefilled, not placeholder
    const input = page.locator('input[name="skus"]');
    const inputValue = await input.inputValue();
    expect(inputValue).toContain(firstSku);
    expect(inputValue).toContain(secondSku);
    const placeholder = await input.getAttribute("placeholder");
    expect(placeholder).toBe("");
  });
});
