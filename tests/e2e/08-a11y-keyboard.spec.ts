// UC-12 | NFR-09 keyboard navigation and focus management
import { test, expect, waitForBoot, agentExecute, confirmDialog } from "./fixtures/app.ts";

test.describe("UC-12 keyboard and screen-reader path", () => {
  test.beforeEach(async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
  });

  test("the three screens are a labelled tablist switchable with arrow keys", async ({ webmcpPage: page }) => {
    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(3); // three screens, no fourth (R7)

    const batch = page.getByRole("tab", { name: "Batch" });
    await expect(batch).toHaveAttribute("aria-selected", "true");

    await batch.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Shipping" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Shipping" })).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Holds" })).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Shipping" })).toHaveAttribute("aria-selected", "true");

    // Each tab controls a labelled panel.
    for (const id of ["batch", "shipping", "holds"]) {
      await expect(page.locator(`#panel-${id}`)).toHaveAttribute("aria-labelledby", `tab-${id}`);
    }
  });

  test("the confirmation dialog is modal, focused, trapped and dismissible", async ({ webmcpPage: page }) => {
    const goalInput = page.getByTestId("goal-input");
    await goalInput.focus();

    const promise = agentExecute(page, "hold_order", { lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }], ttlMinutes: 15 });
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-labelledby", "confirm-title");

    // Focus lands on the primary action.
    await expect(page.getByTestId("confirm-action")).toBeFocused();

    // Tab is trapped inside the dialog: cycling never escapes it.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return !!d && !!document.activeElement && d.contains(document.activeElement);
      });
      expect(inside, `focus escaped the dialog after ${i + 1} tabs`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await promise;
    await expect(dialog).toBeHidden();

    // Focus returns to where it was before the dialog opened.
    await expect(goalInput).toBeFocused();
  });

  test("the goal input and primary action are reachable and labelled", async ({ webmcpPage: page }) => {
    await expect(page.getByLabel("Goal")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run batch" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "OpsFlow", level: 1 })).toBeVisible();
  });
});
