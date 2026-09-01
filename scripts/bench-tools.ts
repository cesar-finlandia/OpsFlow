// scripts/bench-tools.ts — measurement loop (copy literally)
import { loadCatalog } from "src/engine/domain/catalog.ts";
import { searchVariants } from "src/engine/domain/catalog.ts";
import { filterVariants } from "src/engine/domain/filter.ts";
import { quoteShipping } from "src/engine/domain/shipping.ts";
import { holdsStore } from "src/engine/domain/holdsStore.ts";
import { loadZones } from "src/engine/domain/shipping.ts";
import fs from "node:fs";
// tools exercised via their domain functions (pure, in-memory); DP-TOOLS adds validation/abort overhead but domain is the hot path
const ITER = 50;
const catalog = loadCatalog();
const zones = loadZones();
type BenchRow = { name: string; samples_ms: number[]; p50_ms: number; p95_ms: number; p95_ok: boolean };
function p(xs: number[], pct: number): number { const s=[...xs].sort((a,b)=>a-b); const i=Math.ceil(s.length*pct/100)-1; return s[Math.max(0,Math.min(i,s.length-1))]; }
async function benchOne(name: string, fn: () => void): Promise<BenchRow> {
  const samples: number[] = [];
  for (let i=0;i<ITER;i++) { const t0=performance.now(); fn(); const dt=performance.now()-t0; samples.push(dt); }
  const p50=p(samples,50), p95=p(samples,95);
  return { name, samples_ms: samples, p50_ms: Math.round(p50*100)/100, p95_ms: Math.round(p95*100)/100, p95_ok: p95 < 300 };
}
async function main() {
  const rows: BenchRow[] = [];
  rows.push(await benchOne("search_inventory", ()=> searchVariants(catalog, { query: "blue", limit: 25 })));
  rows.push(await benchOne("filter_variants", ()=> filterVariants(catalog, { options: { color: "blue" }, maxPriceCents: 4000 }, undefined)));
  rows.push(await benchOne("calculate_shipping", ()=> quoteShipping(catalog, zones, { items: [{ sku: catalog.products[0].variants[0].sku, qty: 1 }], zone: 4, service: "ground" })));
  // hold_order and confirm_fulfillment are store ops — reset between iterations so state does not leak
  rows.push(await benchOne("hold_order", ()=> { holdsStore.reset(); holdsStore.create({ lineItems: [{ sku: catalog.products[0].variants[0].sku, qty: 1 }], ttlMinutes: 15 }, null, new Date()); }));
  rows.push(await benchOne("confirm_fulfillment", ()=> { holdsStore.reset(); const h=holdsStore.create({ lineItems: [{ sku: catalog.products[0].variants[0].sku, qty: 1 }], ttlMinutes: 15 }, null, new Date()); if(h.ok) holdsStore.confirm((h as any).data.hold.hold_id, new Date()); }));
  // write report
  fs.mkdirSync("reports/bench", { recursive: true });
  fs.writeFileSync("reports/bench/bench-report.json", JSON.stringify({ iterations: ITER, tools: rows, threshold_ms: 300, all_ok: rows.every(r=>r.p95_ok) }, null, 2));
  console.log(`[bench:tools] ${rows.map(r=>`${r.name} p95=${r.p95_ms}ms ${r.p95_ok?"ok":"FAIL"}`).join(" | ")}`);
  if (!rows.every(r=>r.p95_ok)) process.exit(1);
}
main().catch(e=>{ console.error(e); process.exit(1); });
