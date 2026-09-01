import * as React from "react";
import type { EventEnvelope } from "src/platform/transport";
import { StepStatusIndicator, isDegradedEnvelope } from "src/platform/ui";
import { StatusDot, type DotStatus } from "src/ui/components/StatusDot.tsx";

/** Colour encodes agency (§3.1): degraded is its own channel, never an error. */
function dotStatus(status: string, degraded: boolean): DotStatus {
  if (status === "error") return "error";
  if (degraded) return "degraded";
  if (status === "done") return "done";
  return "running";
}

export function CoExecutionTimeline({ envelopes }: { envelopes: EventEnvelope[] }): JSX.Element {
  const traceStartMs = React.useMemo(() => {
    if (envelopes.length === 0) return null;
    const times = envelopes.map((e) => new Date(e.timestamp).getTime()).filter((n) => !Number.isNaN(n));
    return times.length ? Math.min(...times) : null;
  }, [envelopes]);

  return (
    <div aria-live="polite" data-testid="co-timeline" className="opsflow-timeline__list">
      {envelopes.map((env, idx) => {
        const elapsed = traceStartMs !== null ? new Date(env.timestamp).getTime() - traceStartMs : 0;
        const degraded = isDegradedEnvelope(env);
        const testId = env.step_id.startsWith("tool.") ? `tool-${env.step_id.replace("tool.", "")}` : env.step_id;
        return (
          <div key={`${env.step_id}-${env.sequence}-${idx}`} className="opsflow-timeline__entry" data-step={env.step_id} data-testid={testId}>
            <StatusDot status={dotStatus(env.status, degraded)} />
            <div className="opsflow-timeline__head">
              {/* The chassis indicator already renders the status badge and the
                  step label, so the step id is not repeated here. */}
              <StepStatusIndicator envelopes={[env]} />
              <span className="opsflow-timeline__elapsed">{elapsed}ms</span>
              {degraded && <span className="opsflow-chip opsflow-chip--low">Degraded — cached/local data</span>}
            </div>
            <pre>{JSON.stringify(env.payload ?? {}, null, 1)}</pre>
          </div>
        );
      })}
    </div>
  );
}
