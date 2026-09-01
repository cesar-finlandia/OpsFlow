// Requirement IDs: FR-19, FR-20, NFR-11, MAN-03 | DP-SHIP / DP-DEV
// Vite config for the OpsFlow console. Vitest reads the `test` block below.
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

/** Route path → handler module, mirroring §2.6's frozen HTTP API. */
const API_ROUTES: Record<string, string> = {
  "/api/health": "/api/health.ts",
  "/api/inventory/search": "/api/inventory/search.ts",
  "/api/inventory/filter": "/api/inventory/filter.ts",
  "/api/shipping/quote": "/api/shipping/quote.ts",
  "/api/agent/plan": "/api/agent/plan.ts",
};

/** Headers frozen in §2.6.3 / vercel.json, applied in dev so MAN-03 is testable locally. */
const FROZEN_HEADERS: Array<[string, string]> = [
  ["Origin-Agent-Cluster", "?1"],
  ["Permissions-Policy", "tools=(self)"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
];

/**
 * Serve `api/**` through the dev server.
 *
 * In production Vercel runs each file in `api/` as a serverless function. Vite
 * knows nothing about that convention, so `npm run dev` used to serve no API at
 * all: every read-only tool fell back to the in-browser catalog and the whole
 * console rendered permanently degraded. That makes local development and E2E
 * testing exercise a path judges will never see. This plugin adapts the same
 * handler modules to the dev server, so `npm run dev` and `vercel --prod` run
 * identical code.
 */
function apiDevServer(): Plugin {
  return {
    name: "opsflow-api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = (req.url ?? "").split("?")[0] ?? "";
        const modulePath = API_ROUTES[url];
        for (const [key, value] of FROZEN_HEADERS) res.setHeader(key, value);
        if (!modulePath) return next();

        // Vercel parses JSON bodies before invoking the handler; mirror that.
        let body: unknown;
        if (req.method === "POST" || req.method === "PUT") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString("utf8");
          if (raw.length > 0) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = raw; // handlers reject malformed JSON with 400 themselves
            }
          }
        }

        // Minimal VercelResponse surface used by api/_shared.ts.
        let statusCode = 200;
        const vercelRes = {
          status(code: number) { statusCode = code; return vercelRes; },
          setHeader(key: string, value: string) { res.setHeader(key, value); return vercelRes; },
          send(payload: string) { res.statusCode = statusCode; res.end(payload); return vercelRes; },
          json(payload: unknown) { res.statusCode = statusCode; res.end(JSON.stringify(payload)); return vercelRes; },
        };

        try {
          const mod = await server.ssrLoadModule(modulePath);
          const handler = (mod as { default: (rq: unknown, rs: unknown) => Promise<void> }).default;
          await handler({ method: req.method, body, headers: req.headers, url: req.url }, vercelRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: { code: "DEGRADED", message: String((err as Error)?.message ?? err) } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [apiDevServer()],
  resolve: {
    alias: {
      src: `${root}src`,
      examples: `${root}examples`,
      data: `${root}data`,
    },
  },
  preview: {
    headers: Object.fromEntries(FROZEN_HEADERS),
  },
  test: {
    globals: true,
    environment: "jsdom",
    // The entry's own suite lives under tests/ (§2.7: "tests/ — every plan adds
    // its own subfolder"). `src/**/__tests__` holds the vendored chassis
    // module's own tests, which belong to the chassis repository and exercise
    // code this app does not call at runtime (data/catalog.json is generated
    // and committed). Running them here would make `npm test` report failures
    // that no entry plan owns and that NFR-05 forbids fixing in place.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    alias: {
      src: `${root}src`,
      data: `${root}data`,
    },
  },
});

/** Read the frozen header set from vercel.json — used by scripts/verify-headers.mjs. */
export function frozenHeaders(): Array<[string, string]> {
  const cfg = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as {
    headers: Array<{ headers: Array<{ key: string; value: string }> }>;
  };
  return cfg.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value] as [string, string]));
}
