// DP-SRV private helpers — no other module may import
import type { VercelRequest, VercelResponse } from "@vercel/node";

export function withCors(res: VercelResponse): void {
  // same-origin only — do not set Access-Control-Allow-Origin: *
  res.setHeader("Vary", "Origin");
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

export function badRequest(res: VercelResponse, message: string, details?: Record<string, unknown>): void {
  sendJson(res, 400, { ok: false, error: { code: "INVALID_INPUT", message, details } });
}

export function readJson(req: VercelRequest): unknown {
  // Vercel already parses JSON; this helper enforces the 32 KB cap
  const raw = (req as unknown as { body: unknown }).body;
  if (raw === undefined || raw === null) return {};
  // 32 KB body cap — measure the serialized form if body was already parsed
  const serialized = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (serialized.length > 32 * 1024) {
    throw Object.assign(new Error("body exceeds 32 KB"), { code: "INVALID_INPUT" });
  }
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (e) { throw Object.assign(new Error("invalid JSON"), { code: "INVALID_INPUT" }); }
  }
  return raw;
}

export function methodGuard(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (!allowed.includes(req.method ?? "")) {
    sendJson(res, 405, { ok: false, error: { code: "INVALID_INPUT", message: `POST required` } });
    return false;
  }
  return true;
}
