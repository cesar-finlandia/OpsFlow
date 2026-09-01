// Requirement IDs: FR-13, FR-14, NFR-09 | DP-UI · visual_identity_plan.md §7.2
//
// The Agent Activity widget. Clicking "Run batch" starts a chain of network and
// tool calls with no immediate result — the moment the trust question is
// decided — so it gets a purpose-built widget rather than a spinner.
//
// It answers five questions at a glance: what is running, which of how many
// steps, why (the planner's own rationale), how long so far, and where the
// human gate is coming. The SVG is aria-hidden; the status line is the
// accessible text, in a polite live region.

import * as React from "react";

/** The two tools that never fire without a human click (FR-05/FR-06). */
const GATE_TOOLS = new Set(["hold_order", "confirm_fulfillment"]);

/** Short rail labels — the status line carries the full tool name. */
const SHORT_LABEL: Record<string, string> = {
  search_inventory: "search",
  filter_variants: "filter",
  calculate_shipping: "quote",
  hold_order: "hold",
  confirm_fulfillment: "confirm",
};

function shortLabel(tool: string): string {
  return SHORT_LABEL[tool] ?? tool.split("_")[0]!.slice(0, 8);
}

function useElapsed(): number {
  const [ms, setMs] = React.useState(0);
  React.useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setMs(Date.now() - started), 100);
    return () => clearInterval(id);
  }, []);
  return ms;
}

export type ActivityStep = { tool: string; rationale?: string };

export function AgentActivity({
  steps,
  currentStep,
  totalSteps,
  tool,
  rationale,
}: {
  /** Plan steps from the `agent.plan` envelope; may be empty before the plan lands. */
  steps: ActivityStep[];
  /** 1-based index of the step in flight. */
  currentStep: number;
  totalSteps: number;
  tool: string;
  rationale: string;
}): JSX.Element {
  const elapsed = useElapsed();
  const seconds = (elapsed / 1000).toFixed(1);

  // Before the plan arrives the rail still renders the frozen five-tool chain,
  // so the widget never shows an empty box on the first paint.
  const railSteps: ActivityStep[] =
    steps.length > 0
      ? steps
      : ["search_inventory", "filter_variants", "calculate_shipping", "hold_order", "confirm_fulfillment"].map((t) => ({
          tool: t,
        }));

  const activeIdx = Math.min(Math.max(currentStep - 1, 0), railSteps.length - 1);
  const n = railSteps.length;
  const PAD = 18;
  const W = 300;
  const span = W - PAD * 2;
  const x = (i: number): number => (n === 1 ? W / 2 : PAD + (i * span) / (n - 1));

  return (
    <div className="of-activity opsflow-running" aria-live="polite">
      <div className="of-activity__head">
        <span className="of-activity__eyebrow">Agent running…</span>
        <span className="of-activity__tool">
          step {currentStep} of {totalSteps}: {tool}
        </span>
        <span className="of-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="of-activity__elapsed">{seconds}s</span>
      </div>

      <svg className="of-rail" viewBox={`0 0 ${W} 30`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        {railSteps.slice(0, -1).map((_, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <line
              key={`seg-${i}`}
              className={`of-rail__wire${done ? " of-rail__wire--done" : ""}${active ? " of-rail__wire--active" : ""}`}
              x1={x(i)}
              y1={12}
              x2={x(i + 1)}
              y2={12}
            />
          );
        })}
        {railSteps.map((s, i) => {
          const gate = GATE_TOOLS.has(s.tool);
          const done = i < activeIdx;
          const active = i === activeIdx;
          const cls = [
            "of-rail__node",
            gate ? "of-rail__node--gate" : "",
            done ? "of-rail__node--done" : "",
            active ? "of-rail__node--active" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g key={`node-${s.tool}-${i}`}>
              <circle className={cls} cx={x(i)} cy={12} r={gate ? 5 : 4} />
              <text className={`of-rail__label${active ? " of-rail__label--active" : ""}`} x={x(i)} y={27}>
                {shortLabel(s.tool)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="of-activity__rationale">— {rationale}</div>
    </div>
  );
}
