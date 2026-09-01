import * as React from "react";
import { holdsStore } from "src/engine/domain/holdsStore.ts";
import { useSession } from "src/ui/state/session.ts";
import { executeToolCompat } from "src/webmcp/policy.ts";
import type { Hold, Fulfillment } from "src/engine/types.ts";
import { TtlRing } from "src/ui/components/TtlRing.tsx";
import { CommittedIcon, SignalMark } from "src/ui/components/Icons.tsx";

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function useHoldCountdown(expires_at: string): number {
  const [remaining, setRemaining] = React.useState(() => Math.max(0, Math.floor((new Date(expires_at).getTime() - Date.now()) / 1000)));
  React.useEffect(() => {
    const id = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(expires_at).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    }, 1000);
    return () => clearInterval(id);
  }, [expires_at]);
  return remaining;
}

function HoldRow({ hold, onRelease, onConfirm }: { hold: Hold; onRelease: (id: string) => void; onConfirm: (id: string) => void }): JSX.Element {
  const remaining = useHoldCountdown(hold.expires_at);
  const isExpiredLive = Date.now() > new Date(hold.expires_at).getTime();
  const isExpiredRow = isExpiredLive || hold.status === "expired";
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const showExpiredText = isExpiredRow;
  // Status colour encodes agency (visual_identity_plan.md §3.1): held = Gate
  // amber (you must act), confirmed = Commit green, everything else neutral.
  // The literal status word is unchanged and still carries the meaning.
  const statusVariant =
    hold.status === "held" ? "held" : hold.status === "confirmed" ? "confirmed" : "neutral";
  const grantedSeconds = Math.max(1, hold.ttl_minutes * 60);

  return (
    <tr className={isExpiredRow ? "of-row--expired" : undefined} {...(isExpiredRow ? { "aria-label": "expired" } : {})}>
      <td className="of-mono">{hold.hold_id}</td>
      <td>{hold.line_items.length} SKUs</td>
      <td><span className={`of-status-chip of-status-chip--${statusVariant}`}>{hold.status}</span></td>
      <td>
        <span className="of-ttl">
          <TtlRing remaining={remaining} total={grantedSeconds} expired={isExpiredRow} />
          <span>
            {isExpiredLive ? "Expired" : `expires in ${mm}:${ss}`}
            {showExpiredText && <span> Expired — release to clear</span>}
          </span>
        </span>
      </td>
      <td>
        <span className="of-row-actions">
          <button type="button" onClick={() => onRelease(hold.hold_id)}>Release</button>
          <button type="button" onClick={() => onConfirm(hold.hold_id)} disabled={isExpiredRow} title={isExpiredRow ? "Hold expired — cannot confirm" : undefined}>Confirm</button>
        </span>
      </td>
    </tr>
  );
}

export function HoldsScreen(): JSX.Element {
  const { holds: sessionHolds, envelopes } = useSession();
  const [storeHolds, setStoreHolds] = React.useState<Hold[]>(() => holdsStore.list());
  const [clickFulfillment, setClickFulfillment] = React.useState<{ fulfillment: Fulfillment; hold: Hold } | null>(null);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // The committed banner (FR-13) must appear whoever confirmed the hold — the
  // operator clicking Confirm here, or an external agent calling
  // `confirm_fulfillment` through document.modelContext. Deriving it from the
  // co-execution timeline covers both; local click state alone covered only one,
  // so an agent-driven batch committed silently.
  const envelopeFulfillment = React.useMemo(() => {
    for (let i = envelopes.length - 1; i >= 0; i -= 1) {
      const env = envelopes[i]!;
      if (env.step_id !== "tool.confirm_fulfillment" || env.status !== "done") continue;
      const outcome = (env.payload as { outcome?: { ok: boolean; data?: { fulfillment: Fulfillment; hold: Hold } } })?.outcome;
      if (outcome?.ok && outcome.data) return outcome.data;
    }
    return null;
  }, [envelopes]);

  const lastFulfillment = clickFulfillment ?? envelopeFulfillment;

  React.useEffect(() => {
    setStoreHolds(holdsStore.list());
    const unsub = holdsStore.subscribe((h) => setStoreHolds([...h]));
    return unsub;
  }, []);

  const holds = storeHolds.length > 0 ? storeHolds : sessionHolds;

  function handleRelease(holdId: string): void {
    holdsStore.release(holdId);
    setStoreHolds(holdsStore.list());
  }

  async function handleConfirm(holdId: string): Promise<void> {
    setConfirmError(null);
    try {
      const res = await executeToolCompat("confirm_fulfillment", { holdId } as unknown as Record<string, unknown>);
      if ((res as { ok: boolean }).ok) {
        const data = (res as { ok: true; data: { fulfillment: Fulfillment; hold: Hold } }).data;
        setClickFulfillment({ fulfillment: data.fulfillment, hold: data.hold });
        setStoreHolds(holdsStore.list());
      } else {
        const err = (res as { ok: false; error: { code: string; message: string } }).error;
        setConfirmError(`${err.code}: ${err.message}`);
      }
    } catch (e) {
      setConfirmError(String(e));
    }
  }

  if (holds.length === 0) {
    return (
      <div>
        <div className="opsflow-empty">
          <SignalMark size={22} className="opsflow-mark of-empty-mark" />
          <span>No holds yet — search and hold variants from the Batch tab.</span>
        </div>
        {lastFulfillment && (
          <div role="status" className="of-committed">
            <CommittedIcon />
            <span>
            Fulfillment {lastFulfillment.fulfillment.fulfillment_id} confirmed from {lastFulfillment.fulfillment.hold_id} — {lastFulfillment.fulfillment.line_items.length} SKUs, {formatCents(lastFulfillment.fulfillment.total_cents)} — manual baseline 25 min saved.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="of-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hold ID</th>
            <th>Items</th>
            <th>Status</th>
            <th>TTL</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {holds.map((hold) => (
            <HoldRow key={hold.hold_id} hold={hold} onRelease={handleRelease} onConfirm={handleConfirm} />
          ))}
        </tbody>
      </table>
      </div>
      {confirmError && <div role="alert">{confirmError}</div>}
      {lastFulfillment && (
        <div role="status" className="of-committed">
          <CommittedIcon />
          <span>
          Fulfillment {lastFulfillment.fulfillment.fulfillment_id} confirmed from {lastFulfillment.fulfillment.hold_id} — {lastFulfillment.fulfillment.line_items.length} SKUs, {formatCents(lastFulfillment.fulfillment.total_cents)} — manual baseline 25 min saved.
          </span>
        </div>
      )}
    </div>
  );
}
