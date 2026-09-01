import { planGoal } from "./planner.ts";
import { executeToolCompat } from "../webmcp/policy.ts";
import { emitToolEvent, newTraceId } from "../engine/envelopes.ts";
import { appendTranscript } from "../engine/context.ts";
import type { ToolPlan, ToolOutcome, ToolName } from "../engine/types.ts";

let ctrl: AbortController | null = null;

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as Record<string, unknown>;
  const name = err["name"];
  const code = err["code"];
  const message = err["message"];
  if (name === "AbortError") return true;
  if (code === "TOOL_ABORTED") return true;
  if (typeof message === "string" && /abort/i.test(message)) return true;
  return false;
}

function getCurrentSkus(): string[] | undefined {
  try {
    const g = (globalThis as unknown as Record<string, unknown>)["__opsflow_getLastResultSkus"];
    if (typeof g === "function") {
      const v = (g as () => unknown)();
      if (Array.isArray(v)) return v as string[];
    }
  } catch {}
  try {
    const w = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>)["__opsflow_getLastResultSkus"] : undefined;
    if (typeof w === "function") {
      const v = (w as () => unknown)();
      if (Array.isArray(v)) return v as string[];
    }
  } catch {}
  return undefined;
}

export const orchestrator: {
  run(goal: string, opts?: { signal?: AbortSignal }): Promise<{ plan: ToolPlan; results: Array<ToolOutcome<unknown>>; traceId: string }>;
  abort(): void;
} = {
  async run(goal: string, opts?: { signal?: AbortSignal }): Promise<{ plan: ToolPlan; results: Array<ToolOutcome<unknown>>; traceId: string }> {
    const traceId = newTraceId();
    await emitToolEvent("agent.plan", "started", { goal }, { traceId });
    const skus = getCurrentSkus();
    const plan = await planGoal(goal, skus ? { skus } : undefined);
    await emitToolEvent("agent.plan", "done", { planner: plan.planner, steps: plan.steps, degraded: plan.degraded }, { traceId, degraded: plan.degraded });
    appendTranscript("user", goal);
    ctrl = new AbortController();
    let onExternalAbort: (() => void) | null = null;
    if (opts?.signal) {
      if (opts.signal.aborted) {
        ctrl.abort();
      } else {
        onExternalAbort = () => {
          try { ctrl?.abort(); } catch {}
        };
        try { opts.signal.addEventListener("abort", onExternalAbort, { once: true }); } catch {}
      }
    }
    const results: Array<ToolOutcome<unknown>> = [];
    try {
      for (const step of plan.steps) {
        if (ctrl.signal.aborted || opts?.signal?.aborted) {
          break;
        }
        let outcome: ToolOutcome<unknown>;
        try {
          outcome = await executeToolCompat(step.tool as ToolName, step.args as Record<string, unknown>, { signal: ctrl.signal });
        } catch (e: unknown) {
          if (isAbortError(e)) {
            outcome = { ok: false, error: { code: "TOOL_ABORTED", message: "Aborted" } };
          } else {
            outcome = { ok: false, error: { code: "DEGRADED", message: String((e as Error)?.message ?? e) } };
          }
        }
        results.push(outcome);
        try {
          appendTranscript("tool", `${step.tool}: ${JSON.stringify(outcome).slice(0, 400)}`);
        } catch {}
        if (!outcome.ok) {
          const code = outcome.error.code;
          if (
            code === "INVALID_INPUT" ||
            code === "NOT_FOUND" ||
            code === "CONFLICT" ||
            code === "EXPIRED" ||
            code === "NEEDS_CONFIRMATION" ||
            code === "TOOL_ABORTED"
          ) {
            break;
          }
        }
      }
    } finally {
      if (onExternalAbort && opts?.signal) {
        try { opts.signal.removeEventListener("abort", onExternalAbort); } catch {}
      }
      ctrl = null;
    }
    return { plan, results, traceId };
  },
  abort(): void {
    if (ctrl == null) return;
    try { ctrl.abort(); } catch {}
  },
};
