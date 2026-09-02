import * as React from "react";
import { executeToolCompat } from "src/webmcp/policy.ts";
import { useSession } from "src/ui/state/session.ts";
import type { ShippingZone, ServiceLevel } from "src/engine/types.ts";
import { SignalMark } from "src/ui/components/Icons.tsx";
import { HelpTip } from "src/ui/components/HelpTip.tsx";
import { loadCatalog, variantBySku } from "src/engine/domain/catalog.ts";

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export function ShippingScreen(): JSX.Element {
  const { resultSkus = [], selectedSkus = [], effectiveSkus: eff, lastQuote } = useSession() as { resultSkus?: string[]; selectedSkus?: string[]; effectiveSkus?: string[]; lastQuote: import("src/engine/types.ts").ShippingQuote | null };
  const [zone, setZone] = React.useState<ShippingZone>(4);
  const [service, setService] = React.useState<ServiceLevel>("ground");
  const [skusText, setSkusText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [showExplain, setShowExplain] = React.useState(false);

  // Effective set is what Batch checkboxes selected, or the last search/filter result if none selected
  const displaySkus = eff ?? (selectedSkus.length > 0 ? selectedSkus : resultSkus) ?? [];
  const hasSelection = (selectedSkus?.length ?? 0) > 0;

  // Prefill textbox with effective SKUs when Batch changes and textbox is empty (user hasn't typed)
  React.useEffect(() => {
    if (displaySkus.length > 0 && skusText === "") {
      setSkusText(displaySkus.join(", "));
    }
  }, [displaySkus.join(",")]);
  // If effective SKUs change to a different set and textbox currently equals old display, update it
  const prevDisplayRef = React.useRef<string>("");
  React.useEffect(() => {
    const cur = displaySkus.join(", ");
    if (cur !== prevDisplayRef.current) {
      if (skusText === prevDisplayRef.current || skusText === "") {
        setSkusText(cur);
      }
      prevDisplayRef.current = cur;
    }
  }, [displaySkus]);

  async function handleDeclarativeSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    try {
      const skus = (skusText || displaySkus.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
      const items = skus.map((sku) => ({ sku, qty: 1 }));
      await executeToolCompat("calculate_shipping", { items, zone, service });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {!lastQuote && !submitting && (
        <div className="opsflow-empty">
          <SignalMark size={22} className="opsflow-mark of-empty-mark" />
          <span>No shipping quote yet — run a batch or use the declarative form below.</span>
        </div>
      )}
      {lastQuote && (
        <div className="opsflow-quote">
          <div className="opsflow-quote__head"><span>Zone {lastQuote.zone} · Service {lastQuote.service}</span><span>{lastQuote.total_weight_g} g</span></div>
          <div className="opsflow-quote__total">{formatCents(lastQuote.total_cents)}</div>
          {lastQuote.surcharges.length > 0 && (
            <ul>
              {lastQuote.surcharges.map((s) => (
                <li key={s.code}>{s.label}: {formatCents(s.amount_cents)}</li>
              ))}
            </ul>
          )}
          {lastQuote.surcharges.length === 0 && <div className="of-quote__section">No surcharges</div>}
          {lastQuote.excluded.length > 0 && (
            <div className="of-quote__section">
              <div className="of-quote__excluded">{lastQuote.excluded.length} variant(s) excluded from quote:</div>
              <ul>
                {lastQuote.excluded.map((e) => (
                  <li key={e.sku}>{e.sku}: {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <span className="of-quote__actions">
            <button onClick={() => setShowExplain((v) => !v)}>{showExplain ? "Hide breakdown" : `Show breakdown (${lastQuote.explain.length} rules)`}</button>
            <HelpTip label="About the rule breakdown" title="Where the number came from">
              <p>Expands the quote into the ordered list of rules that produced it — base rate for the zone, weight bands, each surcharge, and the reason any variant was dropped from the set.</p>
              <p>This is the difference between a rate you can defend to a customer and one you have to trust.</p>
            </HelpTip>
          </span>
          {showExplain && (
            <ol>
              {lastQuote.explain.slice(0, 12).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      <form className="opsflow-form" toolname="calculate_shipping" onSubmit={handleDeclarativeSubmit} aria-label="Shipping calculator (declarative WebMCP form)">
        <span className="of-ribbon" aria-hidden="true">WebMCP · Declarative</span>
        <label>
          Zone
          <select name="zone" value={zone} onChange={(e) => setZone(Number(e.target.value) as ShippingZone)} tooldescription="Shipping zone 1–5; 4 is the demo default">
            <option value={1}>Zone 1 — Local</option>
            <option value={2}>Zone 2 — Regional</option>
            <option value={3}>Zone 3 — National</option>
            <option value={4}>Zone 4 — Cross-country (demo default)</option>
            <option value={5}>Zone 5 — Remote</option>
          </select>
        </label>
        <label>
          Service
          <select name="service" value={service} onChange={(e) => setService(e.target.value as ServiceLevel)} tooldescription="Service level: ground, expedited, or overnight">
            <option value="ground">Ground</option>
            <option value="expedited">Expedited</option>
            <option value="overnight">Overnight</option>
          </select>
        </label>
        <div className="opsflow-count" data-testid="effective-skus-info">
          {displaySkus.length === 0 ? "No SKUs from Batch — run a batch or enter SKUs" : hasSelection ? `${displaySkus.length} selected from Batch (quote will use your selection)` : `${displaySkus.length} from last Batch result (all matched, or select subset in Batch)`}
        </div>
        {displaySkus.length > 0 && (
          <div className="of-table-wrap" data-testid="shipping-selected-panel">
            <div className="opsflow-count">{displaySkus.length} SKU(s) ready to quote — fully disclosed:</div>
            <table>
              <thead><tr><th>SKU</th><th>Title</th><th>Size</th><th>Color</th><th className="of-num">Price</th><th className="of-num">Stock</th></tr></thead>
              <tbody>
                {displaySkus.map((sku) => {
                  const variant = (() => { try { const cat = loadCatalog(); return variantBySku(cat, sku); } catch { return null; } })();
                  return (
                    <tr key={sku}>
                      <td className="of-mono">{sku}</td>
                      <td>{variant?.title ?? "—"}</td>
                      <td>{variant?.options.size ?? "—"}</td>
                      <td>{variant?.options.color ?? "—"}</td>
                      <td className="of-num">{variant ? formatCents(variant.price_cents) : "—"}</td>
                      <td className="of-num">{variant ? `${variant.stock}${variant.stock <= variant.low_stock_threshold ? " (low)" : ""}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <label>
          SKUs (comma-separated, 1–50 items)
          <input name="skus" type="text" value={skusText} placeholder="" onChange={(e) => setSkusText(e.target.value)} tooldescription="Comma-separated variant SKUs to quote; defaults to selected SKUs from Batch tab, or the full Batch result if none selected" />
        </label>
        <span className="of-form__actions">
          <button className="opsflow-primary" type="submit" disabled={submitting}>{submitting ? "Quoting…" : "Calculate shipping (declarative)"}</button>
          <HelpTip label="About this form" title="Quote without the agent">
            <p>Quotes the SKUs in the box — or, if you leave it empty, whatever your last batch produced. Use it to re-price a set after changing the zone or service level.</p>
            <p>The same form is the declarative WebMCP surface: its fields are annotated, so an outside agent can fill and submit it without this page running any custom JavaScript.</p>
          </HelpTip>
        </span>
        <p className="hint">Declarative WebMCP: this form is annotated with <code>{"tool" + "name"}</code> and per-field <code>tooldescription</code> so a WebMCP-aware agent can invoke <code>calculate_shipping</code> without imperative JS.</p>
      </form>
    </div>
  );
}
