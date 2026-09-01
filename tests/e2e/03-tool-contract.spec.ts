// UC-06, UC-07 | FR-07, FR-08, FR-09, NFR-07
import { test, expect, waitForBoot, agentExecute, storedHolds, TOOL_NAMES } from "./fixtures/app.ts";

const UNTRUSTED_MARKER = "[untrusted tool output";

test.describe("UC-06 bad input is refused with a typed error, never a throw", () => {
  test.beforeEach(async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
  });

  const badInputs: Array<{ label: string; tool: string; args: unknown }> = [
    { label: "wrong type for query", tool: "search_inventory", args: { query: 123 } },
    { label: "missing required query", tool: "search_inventory", args: {} },
    { label: "unknown property", tool: "search_inventory", args: { query: "blue", nope: true } },
    { label: "limit above maximum", tool: "search_inventory", args: { query: "blue", limit: 999 } },
    { label: "zone outside the enum", tool: "calculate_shipping", args: { items: [{ sku: "OPS-1002-BLU-M", qty: 1 }], zone: 9, service: "ground" } },
    { label: "unknown service level", tool: "calculate_shipping", args: { items: [{ sku: "OPS-1002-BLU-M", qty: 1 }], zone: 4, service: "teleport" } },
    { label: "empty lineItems with no session context", tool: "hold_order", args: { lineItems: [], ttlMinutes: 15 } },
    { label: "ttl above maximum", tool: "hold_order", args: { lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }], ttlMinutes: 999 } },
    { label: "malformed holdId", tool: "confirm_fulfillment", args: { holdId: "not-a-hold" } },
  ];

  for (const { label, tool, args } of badInputs) {
    test(`${tool}: ${label} → INVALID_INPUT`, async ({ webmcpPage: page }) => {
      const result = await agentExecute(page, tool, args);
      expect(result.isError, "must resolve with isError, never reject").toBe(true);
      const sc = result.structuredContent as { ok: false; error: { code: string; message: string } };
      expect(sc.ok).toBe(false);
      expect(sc.error.code).toBe("INVALID_INPUT");
      expect(typeof sc.error.message).toBe("string");
      expect(sc.error.message.length).toBeGreaterThan(0);
      // No state may be written by a rejected call.
      expect(await storedHolds(page)).toHaveLength(0);
    });
  }

  test("free text is truncated to the configured limit rather than rejected (FR-09)", async ({ webmcpPage: page }) => {
    const result = await agentExecute(page, "search_inventory", { query: "b".repeat(5000) });
    // 200-char cap applies before validation, so this is a valid call.
    expect(result.isError).toBeFalsy();
    const data = (result.structuredContent as { ok: true; data: { query_echo: string } }).data;
    expect(data.query_echo.length).toBe(200);
  });

  test("every tool result is untrusted-marked and under 4000 chars (NFR-07)", async ({ webmcpPage: page }) => {
    const calls: Array<[string, unknown]> = [
      ["search_inventory", { query: "blue" }],
      ["filter_variants", { options: { color: "Blue" } }],
      ["calculate_shipping", { items: [{ sku: "OPS-1002-BLU-M", qty: 1 }], zone: 4, service: "ground" }],
      ["confirm_fulfillment", { holdId: "not-a-hold" }],
    ];
    for (const [tool, args] of calls) {
      const result = await agentExecute(page, tool, args);
      const text = result.content[0]!.text;
      expect(text.startsWith(UNTRUSTED_MARKER), `${tool} untrusted marker`).toBe(true);
      expect(text.length, `${tool} result length`).toBeLessThanOrEqual(4000);
    }
  });

  test("a well-formed but unknown holdId is NOT_FOUND, not INVALID_INPUT", async ({ webmcpPage: page }) => {
    // Schema-valid input passes validation and reaches the confirmation gate
    // first (§2.5: confirm_fulfillment always requires a human click), so the
    // domain error is only observable after granting it.
    const promise = agentExecute(page, "confirm_fulfillment", { holdId: "HOLD-AAAAAAAA" });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByTestId("confirm-action").click();
    const result = await promise;
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { ok: false; error: { code: string } }).error.code).toBe("NOT_FOUND");
  });
});

test.describe("UC-07 abort leaves no partial state (FR-08)", () => {
  test("an already-aborted signal resolves TOOL_ABORTED and writes nothing", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    for (const tool of TOOL_NAMES) {
      const args =
        tool === "search_inventory" ? { query: "blue" }
        : tool === "filter_variants" ? { options: { color: "Blue" } }
        : tool === "calculate_shipping" ? { items: [{ sku: "OPS-1002-BLU-M", qty: 1 }], zone: 4, service: "ground" }
        : tool === "hold_order" ? { lineItems: [{ sku: "OPS-1002-BLU-M", qty: 1 }], ttlMinutes: 15 }
        : { holdId: "HOLD-AAAAAAAA" };

      const result = await agentExecute(page, tool, args, { abort: true });
      expect(result.isError, `${tool} aborted`).toBe(true);
      expect((result.structuredContent as { ok: false; error: { code: string } }).error.code, `${tool} abort code`).toBe("TOOL_ABORTED");
    }

    expect(await storedHolds(page), "abort must leave no partial state").toHaveLength(0);
    // An aborted state-changing tool must not even open the confirmation dialog.
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
