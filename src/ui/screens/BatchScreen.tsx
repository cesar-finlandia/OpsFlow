import * as React from "react";
import { orchestrator } from "src/agent/orchestrator.ts";
import { useSession } from "src/ui/state/session.ts";
import type { VariantMatch } from "src/engine/types.ts";

export function BatchScreen(): JSX.Element {
  const { envelopes } = useSession();
  const [goal, setGoal] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [hasRun, setHasRun] = React.useState(false);
  const [selectedSkus, setSelectedSkus] = React.useState<string[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  // derive plan steps for running message
  let planSteps: Array<{ tool: string; rationale: string }> = [];
  let total = 0;
  for (const env of envelopes) {
    if (env.step_id === "agent.plan" && env.status === "done") {
      const p = env.payload as unknown as { steps?: Array<{ tool: string; rationale: string }> };
      if (Array.isArray(p?.steps)) planSteps = p.steps;
    }
  }
  // derive matches / total / error / degraded from envelopes
  let matches: VariantMatch[] = [];
  let totalVariants = 0;
  let truncated = false;
  let toolError: { code: string; message: string; details?: Record<string, unknown> } | null = null;
  let degraded = false;
  let errorDetails: Record<string, unknown> | undefined;
  for (const env of envelopes) {
    if (env.degraded) degraded = true;
    if ((env.step_id === "tool.search_inventory" || env.step_id === "tool.filter_variants") && env.status === "done") {
      const outcome = (env.payload as { outcome?: { ok: boolean; data?: { matches?: VariantMatch[]; total?: number; truncated?: boolean } } })?.outcome;
      if (outcome?.ok && outcome.data?.matches) {
        matches = outcome.data.matches as VariantMatch[];
        totalVariants = outcome.data.total ?? matches.length;
        truncated = outcome.data.truncated ?? false;
        toolError = null;
      }
    }
    if ((env.step_id === "tool.search_inventory" || env.step_id === "tool.filter_variants") && env.status === "error") {
      const outcome = (env.payload as { outcome?: { ok: boolean; error?: { code: string; message: string; details?: Record<string, unknown> } } })?.outcome;
      if (outcome && !outcome.ok) {
        toolError = { code: outcome.error!.code, message: outcome.error!.message, details: outcome.error!.details };
        errorDetails = outcome.error!.details;
        degraded = (env.degraded === true) || degraded;
      } else {
        const payloadErr = (env.payload as { error?: { code: string; message: string; details?: Record<string, unknown> } })?.error;
        if (payloadErr) { toolError = { code: payloadErr.code, message: payloadErr.message, details: payloadErr.details }; errorDetails = payloadErr.details; }
      }
    }
  }
  // also handle done with ok:false (some tools emit done with error outcome)
  if (!toolError) {
    for (const env of envelopes) {
      if ((env.step_id === "tool.search_inventory" || env.step_id === "tool.filter_variants") && env.status === "done") {
        const outcome = (env.payload as { outcome?: { ok: boolean; error?: { code: string; message: string; details?: Record<string, unknown> } } })?.outcome;
        if (outcome && !outcome.ok) {
          toolError = { code: outcome.error!.code, message: outcome.error!.message, details: outcome.error!.details };
          errorDetails = outcome.error!.details;
          if (env.degraded) degraded = true;
        }
      }
    }
  }
  // if we have matches, totalVariants already set, otherwise derive from last envelope total fallback
  if (matches.length === 0 && totalVariants === 0) {
    // try to get total from zero-match done payload
    for (const env of [...envelopes].reverse()) {
      if ((env.step_id === "tool.search_inventory" || env.step_id === "tool.filter_variants") && env.status === "done") {
        const outcome = (env.payload as { outcome?: { ok: boolean; data?: { total?: number } } })?.outcome;
        if (outcome?.ok && outcome.data) { totalVariants = outcome.data.total ?? 0; break; }
      }
    }
  }

  // running derived values
  let currentStep = 1;
  let totalSteps = planSteps.length || 1;
  let toolName = planSteps[0]?.tool ?? "search_inventory";
  let rationale = planSteps[0]?.rationale ?? "searching inventory";
  if (planSteps.length > 0) {
    const doneToolCount = envelopes.filter((e) => e.step_id.startsWith("tool.") && e.status === "done").length;
    const startedToolCount = envelopes.filter((e) => e.step_id.startsWith("tool.") && e.status === "started").length;
    currentStep = Math.min(totalSteps, Math.max(1, doneToolCount + 1, startedToolCount || 1));
    const idx = Math.min(currentStep - 1, planSteps.length - 1);
    toolName = planSteps[idx]?.tool ?? toolName;
    rationale = planSteps[idx]?.rationale ?? rationale;
  } else if (running) {
    const started = envelopes.filter((e) => e.step_id.startsWith("tool.") && e.status === "started");
    if (started.length > 0) {
      const last = started[started.length - 1] as { step_id: string };
      toolName = last.step_id.replace("tool.", "");
    }
  }
  total = totalVariants;

  function toggleSku(sku: string, checked: boolean): void {
    setSelectedSkus((prev) => {
      if (checked) {
        if (prev.includes(sku)) return prev;
        if (prev.length >= 50) {
          setToast("Selection capped at 50 SKUs — deselect some to add others");
          return prev;
        }
        return [...prev, sku];
      } else {
        setToast(null);
        return prev.filter((s) => s !== sku);
      }
    });
  }

  async function handleRun(): Promise<void> {
    if (!goal.trim()) return;
    setRunning(true);
    setHasRun(true);
    setShowDetails(false);
    try {
      await orchestrator.run(goal);
    } finally {
      setRunning(false);
    }
  }

  const hasRunDerived = hasRun || envelopes.some((e) => e.step_id.startsWith("tool.") && (e.status === "done" || e.status === "error"));
  const showEmptyBeforeRun = !hasRunDerived && !running && matches.length === 0 && !toolError;
  const showZeroMatches = hasRunDerived && !running && !toolError && matches.length === 0;
  const showTable = matches.length > 0;

  return (
    <div>
      <div className="opsflow-goalbar">
      <input
        data-testid="goal-input"
        placeholder="e.g. hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        aria-label="Goal"
      />
      <button className="opsflow-primary" onClick={handleRun} disabled={running} aria-label="Run batch">{running ? "Running…" : "Run batch"}</button>
      <button onClick={handleRun} disabled={running} style={{ display: "none" }} aria-hidden="true">Run with agent</button>
      </div>
      {toast && <div role="status">{toast}</div>}
      {running && (
        <div className="opsflow-running">Agent running… step {currentStep} of {totalSteps}: {toolName} — {rationale}</div>
      )}
      {showEmptyBeforeRun && (
        <div className="opsflow-empty">Enter a goal above — e.g. &apos;hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes&apos; — then click Run with agent.</div>
      )}
      {toolError && !running && (
        <div role="alert">
          <span>{toolError.code}: {toolError.message}</span>
          {degraded && <span> Degraded — cached/local data</span>}
          <button onClick={() => setShowDetails((v) => !v)}>Show details</button>
          {showDetails && errorDetails && <pre>{JSON.stringify(errorDetails, null, 2)}</pre>}
          {showDetails && !errorDetails && <pre>{JSON.stringify(toolError, null, 2)}</pre>}
        </div>
      )}
      {showZeroMatches && (
        <div>
          <div className="opsflow-empty">No variants matched — try broadening the query or clearing the price filter.</div>
          <div className="opsflow-count">0 variants · {total} total</div>
        </div>
      )}
      {/* skeleton rows when running */}
      {running && (
        <table>
          <thead>
            <tr><th>SKU</th><th>Title</th><th>Size</th><th>Color</th><th>Price</th><th>Stock</th><th>Select</th></tr>
          </thead>
          <tbody>
            {[0,1,2].map((i) => (
              <tr key={i}><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td><input type="checkbox" disabled /></td></tr>
            ))}
          </tbody>
        </table>
      )}
      {showTable && !running && (
        <>
          <div className="opsflow-count">{matches.length} variants · {total} total</div>
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Title</th><th>Size</th><th>Color</th><th>Price</th><th>Stock</th><th>Select</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.sku}>
                  <td style={{ fontFamily: "monospace" }}>{m.sku}</td>
                  <td>{m.title}</td>
                  <td><span>{m.options.size}</span></td>
                  <td><span>{m.options.color}</span></td>
                  <td>{"$" + (m.price_cents / 100).toFixed(2)}</td>
                  <td>{m.stock}{m.low_stock && <span className="opsflow-chip opsflow-chip--low">low stock</span>}</td>
                  <td><input type="checkbox" checked={selectedSkus.includes(m.sku)} onChange={(e) => toggleSku(m.sku, e.target.checked)} aria-label={`Select ${m.sku}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="opsflow-count">{selectedSkus.length} selected — quote on Shipping tab</div>
        </>
      )}
      {/* when empty before run but also after run with matches, still need selected caption for empty */}
      {!showTable && !running && selectedSkus.length > 0 && (
        <div>{selectedSkus.length} selected — quote on Shipping tab</div>
      )}
    </div>
  );
}
