// UC-09 | FR-05, FR-06, FR-13, §2.6 client-owned holds
import { test, expect, waitForBoot, agentExecute, confirmDialog, storedHolds } from "./fixtures/app.ts";

/** Create a hold through the tool layer, granting the confirmation. */
async function createHold(page: import("@playwright/test").Page, ttlMinutes = 15): Promise<string> {
  const promise = agentExecute(page, "hold_order", {
    lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }, { sku: "OPS-1005-BLU-M", qty: 2 }],
    ttlMinutes,
    note: "lifecycle test",
  });
  await expect(confirmDialog(page)).toBeVisible();
  await page.getByTestId("confirm-action").click();
  const result = await promise;
  expect(result.isError).toBeFalsy();
  return (result.structuredContent as { ok: true; data: { hold: { hold_id: string } } }).data.hold.hold_id;
}

/** Confirm a hold through the tool layer, granting the confirmation. */
async function confirmHold(page: import("@playwright/test").Page, holdId: string) {
  const promise = agentExecute(page, "confirm_fulfillment", { holdId });
  await expect(confirmDialog(page)).toBeVisible();
  await page.getByTestId("confirm-action").click();
  return promise;
}

test.describe("UC-09 holds lifecycle and every typed refusal", () => {
  test.beforeEach(async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
  });

  test("a hold appears on the Holds screen with its id, item count and TTL", async ({ webmcpPage: page }) => {
    const holdId = await createHold(page);
    await page.getByRole("tab", { name: "Holds" }).click();

    const row = page.locator("tbody tr", { hasText: holdId });
    await expect(row).toBeVisible();
    await expect(row).toContainText("2 SKUs");
    await expect(row).toContainText("held");
    await expect(row).toContainText(/expires in \d{2}:\d{2}/);
  });

  test("confirming commits the batch and shows the fulfillment banner", async ({ webmcpPage: page }) => {
    const holdId = await createHold(page);
    const result = await confirmHold(page, holdId);
    expect(result.isError).toBeFalsy();
    const data = (result.structuredContent as { ok: true; data: { fulfillment: { fulfillment_id: string }; hold: { status: string } } }).data;
    expect(data.hold.status).toBe("confirmed");

    await page.getByRole("tab", { name: "Holds" }).click();
    await expect(page.getByRole("status")).toContainText(data.fulfillment.fulfillment_id);
  });

  test("confirming the same hold twice returns CONFLICT", async ({ webmcpPage: page }) => {
    const holdId = await createHold(page);
    await confirmHold(page, holdId);
    const second = await confirmHold(page, holdId);
    expect(second.isError).toBe(true);
    expect((second.structuredContent as { ok: false; error: { code: string } }).error.code).toBe("CONFLICT");
  });

  test("an expired hold is refused with EXPIRED and cannot be confirmed from the UI", async ({ webmcpPage: page }) => {
    const holdId = await createHold(page, 1); // 1-minute TTL

    // Time-travel past expiry by rewriting the stored expires_at, then reload so
    // the store re-reads it. Holds are client-owned by design (§2.6), so this is
    // the state a real expired hold has.
    await page.evaluate((id) => {
      const raw = window.localStorage.getItem("opsflow.holds.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed) ? parsed : (parsed as { holds?: unknown[] }).holds ?? [];
      const past = new Date(Date.now() - 60_000).toISOString();
      for (const h of list as Array<{ hold_id: string; expires_at: string }>) {
        if (h.hold_id === id) h.expires_at = past;
      }
      window.localStorage.setItem("opsflow.holds.v1", JSON.stringify(Array.isArray(parsed) ? list : { ...(parsed as object), holds: list }));
    }, holdId);
    await page.reload();
    await waitForBoot(page);

    const result = await confirmHold(page, holdId);
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { ok: false; error: { code: string } }).error.code).toBe("EXPIRED");

    await page.getByRole("tab", { name: "Holds" }).click();
    const row = page.locator("tbody tr", { hasText: holdId });
    await expect(row.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  test("releasing a hold removes it from the active list", async ({ webmcpPage: page }) => {
    const holdId = await createHold(page);
    await page.getByRole("tab", { name: "Holds" }).click();
    const row = page.locator("tbody tr", { hasText: holdId });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Release" }).click();
    await expect(row).toContainText("released");

    const result = await confirmHold(page, holdId);
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { ok: false; error: { code: string } }).error.code).toBe("CONFLICT");
  });

  test("a hold survives a full page reload (client-owned state, §2.6)", async ({ webmcpPage: page }) => {
    const holdId = await createHold(page);
    await page.reload();
    await waitForBoot(page);

    expect((await storedHolds(page)).map((h) => h.hold_id)).toContain(holdId);
    await page.getByRole("tab", { name: "Holds" }).click();
    await expect(page.locator("tbody tr", { hasText: holdId })).toBeVisible();
  });
});
