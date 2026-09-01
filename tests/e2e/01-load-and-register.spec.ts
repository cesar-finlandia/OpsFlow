// UC-01, UC-02 | FR-01, FR-10, FR-17, NFR-10, MAN-01
import { test, expect, waitForBoot, TOOL_NAMES } from "./fixtures/app.ts";

const READ_ONLY = new Set(["search_inventory", "filter_variants", "calculate_shipping"]);

test.describe("UC-01 cold load registers five tools", () => {
  test("registers exactly the five frozen tools with hand-written schemas and annotations", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await expect(page).toHaveTitle(/OpsFlow/);

    const tools = await page.evaluate(() =>
      (document as unknown as { modelContext: { getTools: () => Array<{ name: string; description: string; inputSchema: Record<string, unknown>; annotations: Record<string, boolean> }> } })
        .modelContext.getTools(),
    );

    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());

    for (const tool of tools) {
      expect(tool.description, `${tool.name} description`).toBeTruthy();
      expect(tool.description.length, `${tool.name} description`).toBeGreaterThan(20);
      // Hand-written JSON Schema, not a generated stub (MAN-01).
      expect(tool.inputSchema.type, `${tool.name} inputSchema.type`).toBe("object");
      expect(tool.inputSchema.properties, `${tool.name} inputSchema.properties`).toBeTruthy();
      expect(tool.inputSchema.additionalProperties, `${tool.name} rejects unknown props`).toBe(false);
      // Annotations frozen in §2.5.
      expect(tool.annotations.readOnlyHint, `${tool.name} readOnlyHint`).toBe(READ_ONLY.has(tool.name));
      expect(tool.annotations.openWorldHint, `${tool.name} openWorldHint`).toBe(false);
    }

    const holdOrder = tools.find((t) => t.name === "hold_order")!;
    expect(holdOrder.annotations.destructiveHint).toBe(false);
    expect(holdOrder.annotations.idempotentHint).toBe(false);
    const confirm = tools.find((t) => t.name === "confirm_fulfillment")!;
    expect(confirm.annotations.idempotentHint).toBe(true);
  });

  test("registration happens before first render, and idempotently across reloads", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    // FR-01: tools register at first paint, before any user interaction.
    const order = await page.evaluate(() => (window as unknown as { __opsflowBootOrder: string[] }).__opsflowBootOrder);
    expect(order.indexOf("register")).toBeLessThan(order.indexOf("render"));

    // A reload re-runs registration against a fresh host; five, not ten, not zero.
    await page.reload();
    await waitForBoot(page);
    const names = await page.evaluate(() => (window as unknown as { __webmcpHost: { toolNames: () => string[] } }).__webmcpHost.toolNames());
    expect(names).toHaveLength(5);
  });

  test("cold load to five tools registered stays under 1.5 s (NFR-10)", async ({ webmcpPage: page }) => {
    const started = Date.now();
    await page.goto("/");
    await page.waitForFunction(() => {
      const mc = (document as unknown as { modelContext?: { getTools: () => unknown[] } }).modelContext;
      return !!mc && mc.getTools().length === 5;
    });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test("no cross-origin iframe is rendered anywhere (NFR-12)", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);
    for (const tab of ["Batch", "Shipping", "Holds"]) {
      await page.getByRole("tab", { name: tab }).click();
      expect(await page.locator("iframe").count(), `${tab} tab`).toBe(0);
    }
  });
});

test.describe("UC-02 Tool Inspector reads the live registry", () => {
  test("lists the five registered tools with their schemas", async ({ webmcpPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await page.getByRole("button", { name: /Inspect tools/ }).click();
    const inspector = page.getByTestId("tool-inspector");
    await expect(inspector).toBeVisible();

    // Reading live (FR-10) — not the "not registered" schema fallback.
    await expect(inspector).not.toContainText("showing schema fallback");
    for (const name of TOOL_NAMES) {
      await expect(inspector.locator(`[data-tool="${name}"]`)).toBeVisible();
    }
    // The pretty-printed schema is on screen, so a judge can read it.
    await expect(inspector.locator('[data-tool="search_inventory"] pre')).toContainText('"inStockOnly"');
  });

  test("filters the registry rather than printing a constant list", async ({ webmcpPage: page }) => {
    // A sixth tool exists on the host but was not registered by the app.
    await page.addInitScript(() => {
      const install = () => {
        const host = (window as unknown as { __webmcpHost?: { addFakeTool: (n: string) => void } }).__webmcpHost;
        if (host) host.addFakeTool("not_an_opsflow_tool");
        else setTimeout(install, 0);
      };
      install();
    });
    await page.goto("/");
    await waitForBoot(page);

    await page.getByRole("button", { name: /Inspect tools/ }).click();
    const inspector = page.getByTestId("tool-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector).not.toContainText("not_an_opsflow_tool");
    await expect(inspector.locator("[data-tool]")).toHaveCount(5);
  });
});

test.describe("UC-01b WebMCP-unavailable fallback (FR-17)", () => {
  test("names both enablement paths and still runs the product", async ({ plainPage: page }) => {
    await page.goto("/");
    await waitForBoot(page);

    const banner = page.getByText("WebMCP not detected");
    await expect(banner).toBeVisible();
    const bannerText = await page.locator('[role="alert"]').first().innerText();
    expect(bannerText).toContain("ChatGPT");
    expect(bannerText).toContain("chrome://flags/#enable-webmcp-testing");

    // The console is still fully usable — the whole point of FR-17.
    await expect(page.getByTestId("goal-input")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Run batch" })).toBeEnabled();
  });
});
