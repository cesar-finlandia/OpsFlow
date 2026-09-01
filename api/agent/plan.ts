// DP-SRV W4 — planner route: Gemini 2.5 Flash on Vertex AI, guarded, with the
// deterministic planner as the always-available fallback (FR-12).
// The ONLY file that touches model credentials; they are read from the server
// environment through api/_vertex.ts and never reach the browser (NFR-01).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guarded, isDegradedResult } from "../../src/engine/resilience";
import { schemaErrors } from "../../src/engine/schemaCheck";
import { TOOL_SCHEMAS } from "../../src/webmcp/schemas";
import { buildPlannerPrompt } from "../../src/agent/prompt";
import { planDeterministic } from "../../src/agent/deterministic";
import { loadCatalog } from "../../src/engine/domain/catalog";
import { readJson, sendJson, withCors, methodGuard } from "../_shared";
import { vertexAvailable, vertexConfig, vertexAccessToken, vertexGenerateContentUrl } from "../_vertex";
import { recordUsage, overBudget } from "../../src/engine/usage";
import { count } from "../../src/context";
import type { ToolName, PlanStep, ToolPlan } from "../../src/engine/types";

// Same isomorphic checker the browser tool layer uses, so a plan step the page
// would reject never survives server-side validation either.
function getValidationErrors(value: unknown, schema: unknown): Array<{ message: string }> {
  const c = { ...(schema as Record<string, unknown>) };
  delete c["$schema"];
  return schemaErrors(c, value);
}

const PLANNER_MODEL = "gemini-2.5-flash";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  withCors(res);
  if (!methodGuard(req, res, ["POST"])) return;
  // 1) read { goal, context }, truncate goal to 400 chars
  const body = readJson(req) as { goal?: unknown; context?: { skus?: string[] } };
  const rawGoal = typeof body.goal === "string" ? body.goal : "";
  const goal = rawGoal.slice(0, 400);
  const ctx = body.context ?? {};
  // 2) Vertex not configured → deterministic immediately. This is the keyless
  //    path that makes a clean clone runnable with no .env at all (NFR-11).
  if (!vertexAvailable()) {
    const plan = planDeterministic(goal, loadCatalog());
    sendJson(res, 200, plan);
    return;
  }
  // 3) if overBudget() → deterministic with degraded:true
  try {
    if (overBudget()) {
      const plan = { ...planDeterministic(goal, loadCatalog()), degraded: true };
      sendJson(res, 200, plan);
      return;
    }
  } catch {}
  // 4) build prompt via DP-AGENT
  const { system, user } = buildPlannerPrompt(goal, TOOL_SCHEMAS as Record<ToolName, unknown>, ctx);
  // 5) call Gemini inside guarded()
  const result = await guarded(async () => {
    const cfg = vertexConfig();
    if (!cfg) throw new Error("vertex unconfigured");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const token = await vertexAccessToken(controller.signal);
      const vertexBody = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      };
      const r = await fetch(vertexGenerateContentUrl(cfg, PLANNER_MODEL), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(vertexBody),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(`vertex ${r.status}`);
      const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      // Meter the spend (NFR-08). Vertex reports usage; count() is the fallback
      // so the store still moves when usageMetadata is absent.
      let prompt_tokens: number;
      let completion_tokens: number;
      try {
        prompt_tokens = j.usageMetadata?.promptTokenCount ?? (count as unknown as (a: string, b: string) => number)(system + user, "generic-heuristic");
      } catch {
        prompt_tokens = j.usageMetadata?.promptTokenCount ?? Math.ceil((system + user).length / 4) + 4;
      }
      try {
        completion_tokens = j.usageMetadata?.candidatesTokenCount ?? (count as unknown as (a: string, b: string) => number)(text, "generic-heuristic");
      } catch {
        completion_tokens = j.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4) + 4;
      }
      try { recordUsage({ role: "planner", model: PLANNER_MODEL, prompt_tokens, completion_tokens, ts: new Date().toISOString() }); } catch {}
      return text;
    } finally { clearTimeout(timeout); }
  }, { cacheKey: `planner:${goal.slice(0,80)}` });
  // 6) if DegradedResult → deterministic degraded
  if (isDegradedResult(result)) {
    const plan = { ...planDeterministic(goal, loadCatalog()), degraded: true };
    sendJson(res, 200, plan);
    return;
  }
  // 7) parse JSON; validate every step against TOOL_SCHEMAS[step.tool]; drop invalid steps
  let parsed: { steps?: Array<{ tool: string; args: Record<string, unknown>; rationale?: string }> };
  try { parsed = JSON.parse(result as unknown as string); } catch {
    sendJson(res, 200, { ...planDeterministic(goal, loadCatalog()), degraded: true });
    return;
  }
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const valid: PlanStep[] = [];
  for (const s of rawSteps) {
    if (!s.tool || !(s.tool in TOOL_SCHEMAS)) continue;
    const schema = (TOOL_SCHEMAS as Record<string, unknown>)[s.tool as string];
    const errs = getValidationErrors(s.args ?? {}, schema);
    if (errs.length === 0) valid.push({ tool: s.tool as ToolName, args: s.args ?? {}, rationale: s.rationale ?? "gemini" });
  }
  // 8) if zero valid steps or overBudget() after the call → deterministic degraded
  try {
    if (valid.length === 0 || overBudget()) {
      sendJson(res, 200, { ...planDeterministic(goal, loadCatalog()), degraded: true });
      return;
    }
  } catch {
    if (valid.length === 0) {
      sendJson(res, 200, { ...planDeterministic(goal, loadCatalog()), degraded: true });
      return;
    }
  }
  // 9) assemble ToolPlan and reply 200
  const plan: ToolPlan = {
    goal,
    steps: valid,
    planner: PLANNER_MODEL,
    degraded: false,
    created_at: new Date().toISOString(),
  };
  sendJson(res, 200, plan);
}
