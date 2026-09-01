import type { VercelRequest, VercelResponse } from "@vercel/node";
import { schemaErrors } from "../../src/engine/schemaCheck";
import { TOOL_SCHEMAS } from "../../src/webmcp/schemas";
import { loadCatalog, searchVariants } from "../../src/engine/domain/catalog";
import { readJson, sendJson, badRequest, withCors, methodGuard } from "../_shared";

// Same isomorphic checker the browser tool layer uses, so a request rejected in
// the page is rejected identically here (§2.6: 400 INVALID_INPUT). `$schema` is
// metadata, not a constraint, and is stripped before evaluation.
function getValidationErrors(body: unknown, schema: object): Array<{ message: string; path: string; code: string }> {
  const c = { ...(schema as Record<string, unknown>) };
  delete c["$schema"];
  return schemaErrors(c, body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const body = readJson(req) as Record<string, unknown>;
    const schema = TOOL_SCHEMAS["search_inventory"];
    const errors = getValidationErrors(body, schema);
    if (errors.length > 0) {
      badRequest(res, (errors[0] as any).message ?? "INVALID_INPUT", { errors } as any);
      return;
    }
    const catalog = loadCatalog();
    const output = searchVariants(catalog, body as any);
    sendJson(res, 200, { ok: true, data: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("32 KB") || msg.includes("invalid JSON") || (err as any)?.code === "INVALID_INPUT") {
      badRequest(res, msg);
      return;
    }
    const local = (() => {
      try {
        return searchVariants(loadCatalog(), { query: "" } as any);
      } catch {
        return null;
      }
    })();
    if (local) {
      sendJson(res, 200, { ok: true, data: local, degraded: true });
    } else {
      sendJson(res, 500, { ok: false, error: { code: "DEGRADED", message: msg } });
    }
  }
}
