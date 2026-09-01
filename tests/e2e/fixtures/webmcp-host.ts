// Requirement IDs: MAN-01, FR-01, FR-10, FR-11 | E2E strategy §1.1
//
// A minimal WebMCP *host* for E2E runs.
//
// The agents the blueprint targets (ChatGPT's in-app browser, Chrome 149+ behind
// `chrome://flags/#enable-webmcp-testing`) cannot be automated, and the pinned
// Playwright Chromium does not ship the flag. Without a host, `registerTool` —
// the single line the rules require the repository to demonstrate (MAN-01) —
// would never execute in any test.
//
// This is not a test double of the application. It implements only the browser
// side of the contract (`registerTool` / `getTools` / `executeTool`); the tools,
// their schemas and their `execute` callbacks are the app's real ones. When a
// test drives `executeTool`, it is driving production code exactly as an
// external agent would.

/** Source of the host, injected via addInitScript before any app code runs. */
export const WEBMCP_HOST_SCRIPT = `
(() => {
  const tools = new Map();
  const calls = [];

  const modelContext = {
    async registerTool(definition) {
      if (!definition || typeof definition.name !== "string") {
        throw new TypeError("registerTool requires a name");
      }
      if (typeof definition.execute !== "function") {
        throw new TypeError("registerTool requires an execute function");
      }
      // Real hosts reject a duplicate name; register.ts relies on that message
      // to stay idempotent across hot reloads (FR-01).
      if (tools.has(definition.name)) {
        throw new Error("tool already registered: " + definition.name);
      }
      tools.set(definition.name, definition);
    },

    getTools() {
      return Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      }));
    },

    async executeTool(name, args, options) {
      const tool = tools.get(name);
      calls.push({ name, args });
      if (!tool) throw new Error("unknown tool: " + name);
      return await tool.execute(args, options ?? {});
    },
  };

  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    configurable: true,
    enumerable: false,
    writable: false,
  });

  // probeWebMcp() requires origin isolation; the dev server and vercel.json both
  // send Origin-Agent-Cluster: ?1, but the flag is not observable in every
  // Chromium build, so make it explicit for the test host.
  try {
    Object.defineProperty(window, "originAgentCluster", { value: true, configurable: true });
  } catch (_) { /* already defined by the browser — fine */ }

  // Test-only introspection, namespaced so it cannot collide with app state.
  window.__webmcpHost = {
    toolNames: () => Array.from(tools.keys()),
    calls: () => calls.slice(),
    /** Register an extra tool, to prove the inspector reads the live registry. */
    addFakeTool: (name) => {
      tools.set(name, {
        name,
        description: "not registered by the app",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: true },
        execute: async () => ({ content: [{ type: "text", text: "fake" }], structuredContent: { ok: true, data: {} } }),
      });
    },
  };
})();
`;
