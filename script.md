---
script_version: "1.0.0"
total_minutes: 2.75
timing_source: timing.yaml
live_section: coexecution
generated_at: 2026-09-01T17:21:46.112Z
source_plan_hash: 013168fe2f56f8e4
source_manifest_hash: 654c6b106bcbbd7f
fallback: RES-01 degraded — blank template
---

# Script — Pitch Video (2:45) — DRAFT TEMPLATE — fill spoken text manually

> Requirement IDs: SCRIPT-01, SCRIPT-02, SCRIPT-03, SCRIPT-04
> Timing: total 2:45 | sections 5 | live cue: ▶ LIVE DEMO
<!-- total: 165s -->

| Time | Section | Spoken | Visual |
|------|---------|--------|--------|
| 00:00–00:25 | Maya's six tabs; the 25-minute batch | Maya fulfils twenty to forty Shopify orders a day across six tabs — Shopify admin, an inventory spreadsheet, a shipping-rate calculator, and her support inbox. One batch costs her about twenty-five minutes of copy-pasting SKUs, re-checking stock per variant, and recalculating shipping per zone. One typo cancels an order. | Visual: batch |
| 00:25–00:55 | Live URL + Tool Inspector — five tools | OpsFlow is a WebMCP agent-native fulfillment console for solo operators. the page registers five WebMCP tools with typed input schemas — the live URL is origin-isolated and the inspector lists them: search_inventory, filter_variants, calculate_shipping, hold_order, and confirm_fulfillment. | Visual: shipping |
| 00:55–01:50 | **Canonical goal → co-execution timeline → confirmation** | Watch one batch. Maya types her goal and the in-page console plans it, or the ChatGPT agent can call the same tools. The timeline shows the agent chaining search_inventory, then filter_variants narrowing the current set, then calculate_shipping with an explain array for every surcharge and excluded variant. Before hold_order the page stops at a focus-trapped confirmation dialog showing the exact validated arguments — nothing commits without a click — and the same gate guards confirm_fulfillment. That's co-execution: the agent does the chaining, the human does the judgment. | **▶ LIVE DEMO — moving capture** `widget-detail` — moving capture, never a static title card |
| 01:50–02:20 | DevTools WebMCP inspector + registerTool code | In DevTools the WebMCP inspector shows all five tools live from document.modelContext.getTools. here is the imperative registerTool call — one call site, five tools, JSON Schema, annotations, abort handling — and one declarative form fallback in the shipping calculator annotated with toolname. | Visual: widget-detail |
| 02:20–02:45 | Savings meter — 25 min → ~3 min — track line | The savings meter compares this batch to the manual baseline of twenty-five minutes and a hundred-twenty clicks — this run: eight tool calls, two human confirmations, about three minutes. Measured on synthetic data — all two hundred SKUs carry synthetic:true and a visible badge. Track: WebMCP Challenge — Top 10. No bonus integration — not worth dilution. | Visual: search |
