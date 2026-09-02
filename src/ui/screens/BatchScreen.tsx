import * as React from "react";
import { orchestrator } from "src/agent/orchestrator.ts";
import { useSession, setSelectedSkus } from "src/ui/state/session.ts";
import type { VariantMatch } from "src/engine/types.ts";
import { AgentActivity } from "src/ui/components/AgentActivity.tsx";
import { SignalMark } from "src/ui/components/Icons.tsx";
import { HelpTip } from "src/ui/components/HelpTip.tsx";

export function BatchScreen(): JSX.Element {
  const { envelopes, selectedSkus: sessionSelected = [] } = useSession() as { envelopes: import("src/platform/transport").EventEnvelope[]; selectedSkus?: string[] };
  const [goal, setGoal] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [hasRun, setHasRun] = React.useState(false);
  const [selectedSkus, setSelectedLocal] = React.useState<string[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const [aiAnswer, setAiAnswer] = React.useState<string | null>(null);
  const [aiAnswerLoading, setAiAnswerLoading] = React.useState(false);

  // Keep local selection in sync with session (session is source of truth for Shipping)
  React.useEffect(() => { setSelectedLocal([...(sessionSelected ?? [])]); }, [sessionSelected]);

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

  // Derive last AI plan for the new Agent Insight box (must be before hasRunDerived/showEmpty which use isMetaModelQuestion)
  let lastPlan: { planner?: string; steps?: Array<{ tool: string; rationale: string }>; goal?: string; degraded?: boolean } | null = null;
  let lastGoal: string | null = null;
  for (const env of [...envelopes].reverse()) {
    if (env.step_id === "agent.plan" && env.status === "done") {
      lastPlan = env.payload as { planner?: string; steps?: Array<{ tool: string; rationale: string }>; goal?: string; degraded?: boolean };
      lastGoal = (lastPlan as { goal?: string })?.goal ?? null;
      break;
    }
    if (env.step_id === "agent.plan" && env.status === "started") {
      lastGoal = (env.payload as { goal?: string })?.goal ?? null;
    }
  }
  // Heuristic: meta question about the model
  const isMetaModelQuestion = lastGoal ? /which ai model|what model are you|who are you|which model/i.test(lastGoal) : /which ai model|what model are you|who are you/i.test(goal);
  const hasRunDerived = hasRun || envelopes.some((e) => e.step_id.startsWith("tool.") && (e.status === "done" || e.status === "error"));
  const isGeminiPlan = (lastPlan?.planner === "gemini-2.5-flash" || lastPlan?.planner === "gemini-2.0-flash" || lastPlan?.planner === "gemini-3.6-flash" || lastPlan?.planner === "gemini-3.5-flash-lite") && !lastPlan?.degraded;
  const isInformationalForWarning = lastGoal ? /low[- ]?stock|what day|today|what kind|which kind|catalog|show me/i.test(lastGoal) : false;
  // Warning only if no Gemini answer is available — suppress while we are loading an answer for informational queries
  const showAiWarning = hasRunDerived && lastPlan && !isGeminiPlan && !aiAnswer && !aiAnswerLoading && !isInformationalForWarning;
  const aiInsight = (() => {
    if (isMetaModelQuestion) {
      return {
        title: "Agent Insight",
        body: `I am ${lastPlan?.planner ?? "gemini-3.5-flash-lite"} via Vertex AI, powering OpsFlow's fulfillment planner. I translate your single-sentence goal into 5 typed WebMCP tools (search → filter → quote → hold → confirm). Try: "show me the full catalog" or "hold all Olive variants under $10".`,
        planner: lastPlan?.planner ?? "gemini-3.5-flash-lite",
      };
    }
    // For informational questions, show the Gemini-generated answer if available (even if plan was deterministic, answer may be from Gemini)
    if (aiAnswer) {
      return {
        title: "Agent Insight",
        body: aiAnswer,
        planner: lastPlan?.planner ?? "gemini-3.5-flash-lite",
      };
    }
    if (aiAnswerLoading) {
      return {
        title: "Agent Insight",
        body: "Generating summary from catalog…",
        planner: lastPlan?.planner ?? "gemini-3.5-flash-lite",
      };
    }
    // Only Gemini plan logs belong here — deterministic fallback without aiAnswer shows warning, not a log
    if (!isGeminiPlan) return null;
    if (lastPlan) {
      const steps = lastPlan.steps ?? [];
      return {
        title: "Agent Insight",
        body: `${steps.map(s => `${s.tool}`).join(" → ") || "pending"} — ${lastPlan.planner}`,
        planner: lastPlan.planner ?? "gemini-3.5-flash-lite",
      };
    }
    return null;
  })();

  function toggleSku(sku: string, checked: boolean): void {
    setSelectedLocal((prev) => {
      let next: string[];
      if (checked) {
        if (prev.includes(sku)) return prev;
        if (prev.length >= 50) {
          setToast("Selection capped at 50 SKUs — deselect some to add others");
          return prev;
        }
        next = [...prev, sku];
      } else {
        setToast(null);
        next = prev.filter((s) => s !== sku);
      }
      setSelectedSkus(next);
      return next;
    });
  }

  async function handleRun(): Promise<void> {
    if (!goal.trim()) return;
    setRunning(true);
    setHasRun(true);
    setShowDetails(false);
    setAiAnswer(null);
    try {
      await orchestrator.run(goal);
      // For informational questions, fetch a Gemini-generated summary after the search (catalog, low-stock, date)
      const isCatalogQuestion = /what kind of products|which kind of products|what products.*catalog|show.*catalog|full catalog|entire catalog|what.*in.*catalog/i.test(goal);
      const isLowStockQuestion = /low[- ]?stock/i.test(goal);
      const isDateQuestion = /what day|today|current date|date today/i.test(goal);
      const shouldFetchAnswer = isCatalogQuestion || isLowStockQuestion || isDateQuestion;
      if (shouldFetchAnswer) {
        setAiAnswerLoading(true);
        try {
          // Wait for envelopes to settle and read fresh matches via global accessor (avoids stale closure)
          await new Promise(r => setTimeout(r, 400));
          const getSkus = (globalThis as unknown as Record<string, unknown>)["__opsflow_getLastResultSkus"] as (() => string[]) | undefined;
          const getEffective = (globalThis as unknown as Record<string, unknown>)["__opsflow_getEffectiveSkus"] as (() => string[]) | undefined;
          const skus = (getEffective?.() ?? getSkus?.() ?? []) as string[];
          // Build minimal VariantMatch-like objects for the answer endpoint from catalog
          let currentMatches: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number }> = [];
          if (skus.length > 0) {
            try {
              const { loadCatalog, variantBySku } = await import("src/engine/domain/catalog.ts");
              const cat = loadCatalog();
              currentMatches = skus.slice(0, 20).map(sku => {
                const v = variantBySku(cat, sku);
                return v ? { sku: v.sku, title: v.title, options: { ...v.options }, price_cents: v.price_cents } : null;
              }).filter((v): v is NonNullable<typeof v> => v !== null);
            } catch {}
            if (currentMatches.length === 0) {
              // Fallback to raw SKUs as minimal objects
              currentMatches = skus.slice(0, 20).map(sku => ({ sku, title: sku, options: { size: "", color: "" }, price_cents: 0 }));
            }
          }
          const res = await fetch("/api/agent/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal, matches: currentMatches }),
          });
          if (res.ok) {
            const data = await res.json() as { ok: boolean; answer?: string };
            if (data.ok && data.answer) setAiAnswer(data.answer);
          }
        } catch {}
        setAiAnswerLoading(false);
      }
    } finally {
      setRunning(false);
    }
  }

  const showEmptyBeforeRun = !hasRunDerived && !running && matches.length === 0 && !toolError && !isMetaModelQuestion;
  const showZeroMatches = hasRunDerived && !running && !toolError && matches.length === 0 && !isMetaModelQuestion;
  const showTable = matches.length > 0;

  return (
    <div>
      {/* AI response box — only Gemini replies, empty otherwise. Subtle signal tint (26% mix) makes important info legible without attention-grab. Uses tokens so light/dark both fit palette. */}
      <div className="opsflow-ai-insight" data-testid="ai-insight-box" style={{ border: showAiWarning ? "1px solid color-mix(in srgb, var(--of-gate) 55%, transparent)" : "1px solid var(--of-border)", borderRadius: 8, padding: 12, marginBottom: 12, background: showAiWarning ? "var(--of-gate-soft)" : "color-mix(in srgb, var(--of-signal-soft) 26%, var(--of-panel-bg))", opacity: showAiWarning ? 0.95 : 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "var(--of-text)" }}>
          <span>Agent Insight</span>
          <HelpTip label="About Agent Insight" title="What is this box?">
            <p>You can use an AI agent to interact with this website, via an external AI chatbot via WebMCP, or in the text box below. What you type there will be read by an AI and replied by the AI. The replies will show here. The AI will also interact with this website, for example to show the catalog items you selected, to hold catalog items, etc. That will show in the panel below the chat box.</p>
          </HelpTip>
          {showAiWarning && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--of-gate)", background: "color-mix(in srgb, var(--of-gate) 18%, var(--of-gate-soft))", padding: "2px 6px", borderRadius: 4, marginLeft: 8, border: "1px solid color-mix(in srgb, var(--of-gate) 25%, transparent)" }}>AI unavailable — fallback to deterministic</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--of-text-2)", minHeight: 18 }}>
          {aiInsight ? aiInsight.body : ""}
        </div>
        {aiInsight && <div style={{ fontSize: 11, color: "var(--of-text-3)", marginTop: 4 }}>planner: {aiInsight.planner}</div>}
      </div>

      <div style={{ fontWeight: 600, marginBottom: 4 }}>Batch Task — Fulfillment Goal</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Describe what you want the agent to do — search, filter, hold, or ask about the catalog. Press Enter or click Run batch.</div>
      <form className="opsflow-goalbar" onSubmit={(e) => { e.preventDefault(); handleRun(); }}>
      <input
        data-testid="goal-input"
        placeholder="e.g. hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !running && goal.trim()) { e.preventDefault(); handleRun(); } }}
        aria-label="Goal"
        autoFocus
      />
      <button className="opsflow-primary" type="submit" disabled={running} aria-label="Run batch" autoFocus>{running ? "Running…" : "Run batch"}</button>
      <button onClick={handleRun} disabled={running} style={{ display: "none" }} aria-hidden="true">Run with agent</button>
      {/* The label deliberately avoids the word "goal": the input's own
           aria-label is "Goal", and getByLabel matches on substring, so a help
           button naming it would make the input ambiguous to assistive tech and
           to the E2E suite alike (§11.1). */}
      <HelpTip align="end" label="About the instruction box" title="One sentence, one batch">
        <p>Describe the outcome, not the steps: <em>&quot;hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes&quot;</em>. The agent picks which tools to call, in what order, and shows you each one as it goes.</p>
        <p>Starting a batch only reads and quotes. Anything that reserves stock or commits a fulfilment stops and asks you first, with the exact arguments on screen.</p>
      </HelpTip>
      </form>
      {toast && <div role="status">{toast}</div>}
      {running && (
        <AgentActivity
          steps={planSteps}
          currentStep={currentStep}
          totalSteps={totalSteps}
          tool={toolName}
          rationale={rationale}
        />
      )}
      {showEmptyBeforeRun && (
        <div className="opsflow-empty">
          <SignalMark size={22} className="opsflow-mark of-empty-mark" />
          <span>Enter a goal above — e.g. &apos;hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes&apos; — then click Run with agent.</span>
        </div>
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
        <div className="of-table-wrap">
          <table>
            <thead>
              <tr><th>SKU</th><th>Title</th><th>Size</th><th>Color</th><th>Price</th><th>Stock</th><th>Select</th></tr>
            </thead>
            <tbody>
              {/* Skeleton bars are sized to each column's expected content, so the
                  placeholder previews the layout instead of blinking (§7.3). */}
              {[0,1,2].map((i) => (
                <tr key={i} className="of-skel-row">
                  <td><span className="of-skel of-skel--sku" aria-hidden="true" /></td>
                  <td><span className="of-skel of-skel--title" aria-hidden="true" /></td>
                  <td><span className="of-skel of-skel--sm" aria-hidden="true" /></td>
                  <td><span className="of-skel of-skel--sm" aria-hidden="true" /></td>
                  <td className="of-num"><span className="of-skel of-skel--num" aria-hidden="true" /></td>
                  <td className="of-num"><span className="of-skel of-skel--num" aria-hidden="true" /></td>
                  <td><input type="checkbox" disabled /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showTable && !running && (
        <>
          <div className="opsflow-count">{matches.length} variants · {total} total</div>
          <div className="of-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Title</th><th>Size</th><th>Color</th><th className="of-num">Price</th><th className="of-num">Stock</th>
                  <th>
                    <span className="of-th-help">
                      Select
                      <HelpTip align="end" label="About the selection column" title="Correcting the agent">
                        <p>The agent&apos;s filter decided these rows. Ticking and unticking is how you overrule it before anything is reserved.</p>
                        <p>Your selection carries over to the Shipping screen, where it becomes the set that gets quoted. Up to 50 SKUs per batch.</p>
                      </HelpTip>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.sku}>
                    <td className="of-mono">{m.sku}</td>
                    <td>{m.title}</td>
                    <td><span>{m.options.size}</span></td>
                    <td><span>{m.options.color}</span></td>
                    <td className="of-num">{"$" + (m.price_cents / 100).toFixed(2)}</td>
                    <td className="of-num">{m.stock}{m.low_stock && <span className="opsflow-chip opsflow-chip--low">low stock</span>}</td>
                    <td><input type="checkbox" checked={selectedSkus.includes(m.sku)} onChange={(e) => toggleSku(m.sku, e.target.checked)} aria-label={`Select ${m.sku}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
