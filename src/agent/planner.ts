import { apiClient } from "../engine/apiClient.ts";
import { TOOL_SCHEMAS } from "../webmcp/schemas.ts";
import { loadCatalog } from "../engine/domain/catalog.ts";
import { planDeterministic } from "./deterministic.ts";
import { validate } from "src/resilience";
import type { ToolPlan, PlanStep, ToolName } from "../engine/types.ts";

const VALID_TOOLS: ReadonlySet<string> = new Set([
  "search_inventory",
  "filter_variants",
  "calculate_shipping",
  "hold_order",
  "confirm_fulfillment",
]);

function isPlainObject(v: unknown): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v as object);
  return proto === Object.prototype || proto === null;
}

function isArgsValid(tool: string, args: unknown): boolean {
  if (!isPlainObject(args)) return false;
  const raw = TOOL_SCHEMAS[tool as ToolName] as unknown as Record<string, unknown> | undefined;
  if (!raw) return false;
  const schema: Record<string, unknown> = { ...raw };
  delete (schema as Record<string, unknown>)["$schema"];
  // Try both validate signatures and both return shapes
  const tryValidate = (a: unknown, b: unknown): { valid: boolean; errors: unknown[] } | null => {
    try {
      const res = (validate as unknown as (x: unknown, y: unknown) => unknown)(a, b) as unknown;
      if (Array.isArray(res)) return { valid: res.length === 0, errors: res };
      if (res && typeof res === "object" && "valid" in (res as Record<string, unknown>)) {
        const r = res as { valid: boolean; errors?: unknown[] };
        return { valid: !!r.valid, errors: r.errors ?? [] };
      }
      if (res && typeof res === "object" && "errors" in (res as Record<string, unknown>)) {
        const r = res as { errors?: unknown[] };
        const errs = r.errors ?? [];
        return { valid: errs.length === 0, errors: errs };
      }
    } catch {}
    return null;
  };
  let result = tryValidate(schema, args);
  if (result === null) result = tryValidate(args, schema);
  if (result === null) return false;
  return result.valid;
}

function validatePlan(plan: unknown): ToolPlan | null {
  if (typeof plan !== "object" || plan === null || Array.isArray(plan)) return null;
  const p = plan as Record<string, unknown>;
  if (typeof p["goal"] !== "string") return null;
  const steps = p["steps"];
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const validSteps: PlanStep[] = [];
  let dropped = 0;
  for (const s of steps) {
    if (typeof s !== "object" || s === null || Array.isArray(s)) { dropped++; continue; }
    const step = s as Record<string, unknown>;
    const tool = step["tool"];
    const args = step["args"];
    const rationale = step["rationale"];
    if (typeof tool !== "string" || !VALID_TOOLS.has(tool)) { dropped++; continue; }
    if (!isPlainObject(args)) { dropped++; continue; }
    if (typeof rationale !== "string") { dropped++; continue; }
    if (!isArgsValid(tool, args)) { dropped++; continue; }
    validSteps.push({ tool: tool as ToolName, args: args as Record<string, unknown>, rationale: rationale as string });
  }
  if (dropped > 0) {
    try { console.warn(`planGoal: dropped ${dropped} invalid step(s)`); } catch {}
  }
  if (validSteps.length === 0) return null;
  const degraded = typeof p["degraded"] === "boolean" ? (p["degraded"] as boolean) : false;
  const planner = typeof p["planner"] === "string" ? (p["planner"] as ToolPlan["planner"]) : ("deterministic" as ToolPlan["planner"]);
  let created_at: string;
  if (typeof p["created_at"] === "string" && p["created_at"] && !Number.isNaN(Date.parse(p["created_at"] as string))) {
    created_at = p["created_at"] as string;
  } else {
    created_at = new Date().toISOString();
  }
  return {
    goal: p["goal"] as string,
    steps: validSteps,
    planner,
    degraded,
    created_at,
  };
}

export async function planGoal(goal: string, ctx?: { skus?: string[] }): Promise<ToolPlan> {
  try {
    let raw: unknown = null;
    try {
      const res = await apiClient.plan(goal, ctx);
      if (typeof res === "object" && res !== null && !Array.isArray(res)) {
        raw = res;
      } else {
        raw = null;
      }
    } catch {
      raw = null;
    }
    if (raw !== null) {
      const validated = validatePlan(raw);
      if (validated !== null) {
        return validated;
      }
    }
    // fallback to deterministic with degraded:true
    const catalog = loadCatalog();
    const det = planDeterministic(goal, catalog);
    return { ...det, degraded: true };
  } catch {
    try {
      const catalog = loadCatalog();
      const det = planDeterministic(goal, catalog);
      return { ...det, degraded: true };
    } catch {
      return {
        goal: (goal ?? "").slice(0, 400),
        steps: [{ tool: "search_inventory", args: { query: ((goal ?? "").slice(0, 200) || "*"), limit: 25 }, rationale: "search fallback for unparseable goal" }],
        planner: "deterministic",
        degraded: true,
        created_at: new Date().toISOString(),
      };
    }
  }
}
