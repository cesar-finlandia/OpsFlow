# OpsFlow — Full Tutorial & Pre-Deploy Checklist

> **App:** OpsFlow — WebMCP Agent-Native Fulfillment Console for Solo Operators (Maya, freelance ops coordinator, 20–40 orders/day)  
> **Stack:** Vite + React + Vercel (`api/` serverless functions) + 5 WebMCP imperative tools + 1 declarative form  
> **Repo:** `2026-09-webMCP` — clean-clone runnable with **no `.env`** (NFR-11)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install & Compile](#2-install--compile)
3. [Start the Local Server](#3-start-the-local-server)
4. [URLs & Where to Open](#4-urls--where-to-open)
5. [WebMCP Enablement (required for agent mode)](#5-webmcp-enablement)
6. [UI Overview — 3 Screens in 30 Seconds](#6-ui-overview--3-screens-in-30-seconds)
7. [Main Use Cases — Step by Step](#7-main-use-cases--step-by-step)
8. [Tool Reference (for agents / `executeTool`)](#8-tool-reference)
9. [Commands to Run Before Deploying to Vercel](#9-commands-to-run-before-deploying-to-vercel)
10. [Deploy to Vercel](#10-deploy-to-vercel)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | `>=20` (`package.json:9`, `.nvmrc`) | `node --version` |
| npm | any recent (pnpm also works) | `npm --version` |
| Python | `3.11+` only if you run `src/cost` metering | `python3 --version` |
| Browser | Chrome 149+ **or** ChatGPT desktop app in-app browser | — |

No API key is required to run locally. The planner falls back to the deterministic keyword planner and the UI labels which planner ran (`README.md:68-72`).

---

## 2. Install & Compile

```bash
# from the entry root: 2026-09-webMCP/
npm install          # installs vite, vitest, playwright, etc. — ~30-60s first time
npm run build        # production build to dist/ — must succeed with no errors
```

What `npm run build` does (`package.json:13`, `vite.config.ts:86`):
- Runs `vite build` → emits `dist/index.html` + `dist/assets/*` (CSS + ~92 kB gzipped JS)
- Vite warning `[INEFFECTIVE_DYNAMIC_IMPORT]` on `src/webmcp/runTool.ts` is expected and non-blocking.

Verify the build artifact exists:

```bash
ls dist/             # should show index.html + assets/
```

---

## 3. Start the Local Server

### Dev server (with live API — recommended for development)

```bash
npm run dev
# → Vite dev server at http://localhost:5173  (default)
# → api/ routes are served by the vite plugin opsflow-api-dev-server (vite.config.ts:38-84)
#    so POST /api/inventory/search, /api/health etc. work identically to Vercel.
```

### Preview server (production bundle, no API — what judges download)

```bash
npm run preview -- --port 4173
# → serves dist/ at http://localhost:4173
# → No api/ routes — tools fall back to in-browser catalog with a visible degraded banner (FR-18).
```

### Offline rehearsal (zero network — for recording demos without Wi-Fi)

```bash
npm run demo:offline
# → vite-node scripts/demo-offline.ts
# → publishes 14 EventEnvelopes from a mock script, zero fetch() calls
# → also runnable as RES_FORCED_DEGRADED=1 npm run demo:offline  (forces degraded replay)
```

---

## 4. URLs & Where to Open

| Server | URL | When to use |
|---|---|---|
| `npm run dev` | `http://localhost:5173` | Daily development, full API, fastest HMR |
| `npm run dev -- --port 5174` | `http://localhost:5174` | Exact port used by `playwright.config.ts:5` `live` project |
| `npm run preview` | `http://localhost:4173` (or `--port 4174` for E2E `static` project) | Verify the shipped artifact before deploying |
| Production (after deploy) | `https://<project>.vercel.app` | Submitted live URL, frozen Sep 3 13:00 PDT → Sep 21 |

> Tabs are deep-linkable: `?tab=batch`, `?tab=shipping`, `?tab=holds` (`src/ui/App.tsx:24-36`).

---

## 5. WebMCP Enablement

OpsFlow registers 5 tools **before first paint** (`src/main.tsx` → `src/webmcp/register.ts` — MAN-01). Whether an *external* agent can call them depends on the browser:

| Browser | How to enable | Verify |
|---|---|---|
| **ChatGPT desktop app** | Nothing — WebMCP is on by default. Open the deployed URL inside ChatGPT's in-app browser. | In-chat, ask the agent to call `search_inventory`. |
| **Chrome 149+** | Navigate to `chrome://flags/#enable-webmcp-testing` → **Enabled** → **Relaunch**. | Install **Model Context Tool Inspector** extension `gbpdfapgefenggkahomfgkhfehlcenpd` — it should list 5 tools on the page. |
| **Any other browser / flag off** | No setup. The page detects missing WebMCP and shows a yellow **"WebMCP not detected"** banner (`src/ui/components/WebMcpBanner.tsx` — FR-17). | The **in-page Agent Console** still runs the full flow via `executeToolCompat` fallback, so the product is complete even without external agent support. |

Headers that make WebMCP work (`vercel.json:3-9`, `vite.config.ts:20-25`, MAN-03):

```
Origin-Agent-Cluster: ?1
Permissions-Policy: tools=(self)
```

No cross-origin `<iframe>` exists, so `allow="tools"` is intentionally unused (`README.md:39`).

---

## 6. UI Overview — 3 Screens in 30 Seconds

Open `http://localhost:5173` — you see:

**Header**
- `OpsFlow` title + tagline + green **Synthetic data — all 200 SKUs are generated. Every record carries synthetic:true (NFR-04)** badge (`src/ui/App.tsx:58`).
- **Inspect tools (5)** button — toggles the **Tool Inspector** panel (FR-10). It reads `document.modelContext.getTools()` live, not a hardcoded list.

**Tab bar** (keyboard: `ArrowLeft`/`ArrowRight` to switch, `src/ui/App.tsx:41-49`):
- **Batch** — goal input + results table + variant chips
- **Shipping** — quote card + declarative form (MAN-02)
- **Holds** — hold list + confirmation + committed banner

**Always visible below tabs:**
- **Co-execution timeline** (`src/ui/components/CoExecutionTimeline.tsx` — FR-14) — every `EventEnvelope` `started → done/error`, with validated args.
- **Savings meter** (`src/ui/components/SavingsMeter.tsx` — FR-15) — counts tool calls + confirmations vs. the 25-min / 120-click manual baseline in `data/baseline.json`.
- **Degraded banner** (only when `degraded: true` — FR-18) + per-step degraded chip.

---

## 7. Main Use Cases — Step by Step

### Use Case 1 — Agent-Driven Batch (the golden path: search → hold)

This is the demo goal from `master_blueprint_entry.md:286` and the E2E suite UC-04.

1.  Stay on the **Batch** tab (default).
2.  In the **Goal** input (`data-testid="goal-input"`, placeholder `e.g. hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes` — `src/ui/screens/BatchScreen.tsx:135-141`), type:

    ```
    hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes
    ```

    Other goals that work (deterministic planner keywords — `src/agent/deterministic.ts`):

    ```
    search blue jackets
    filter blue variants under $20
    hold OPS-1002-BLU-M for 15 minutes
    ```

3.  Click **Run batch** (the hidden duplicate button is `Run with agent` — same handler, `BatchScreen.tsx:142-143`).
4.  Watch the **Co-execution timeline**: `agent.plan started → done` (shows planner = `deterministic` or `gemini-2.5-flash` + step list), then `tool.search_inventory started → done`, `tool.filter_variants …`, etc.
5.  A **running indicator** appears: `Agent running… step 1 of 3: search_inventory — searching inventory` (`BatchScreen.tsx:146-148`). A 3-row skeleton table renders while running.
6.  When done, a **results table** appears: columns SKU (monospace), Title, Size, Color, Price, Stock, Select checkbox. Low-stock variants show a `low stock` chip. A caption reads e.g. `4 variants · 4 total`.
7.  **Select** 1–50 SKUs via checkboxes. A toast caps at 50: `Selection capped at 50 SKUs` (`BatchScreen.tsx:103-105`). Caption updates: `2 selected — quote on Shipping tab`.
8.  **Confirmation gate** (FR-05): if the plan includes `hold_order`, a focus-trapped `role="dialog" aria-modal="true"` dialog appears (`src/ui/components/ConfirmDialog.tsx`), showing the **resolved line items** and asking to confirm. Press **Confirm** to create the hold, **Cancel** or `Escape` to abort — abort yields `NEEDS_CONFIRMATION` and no hold is created (UC-05).
9.  On confirm, the **Holds** tab gets a new row (see UC-4 below) and the **Savings meter** increments.

**What to assert (for judges / E2E):**
- Timeline has one `agent.plan` pair + one `tool.*` pair per step.
- Results are real synthetic variants from `data/catalog.json` (200 variants, 60 products, `synthetic: true`).
- No `console.error` — `execute` never throws, always resolves with `ToolOutcome` (FR-07).

---

### Use Case 2 — Direct Search & Filter (read-only tool chain)

**Via UI (same as UC-1):** any goal containing `blue`, `search`, `filter`, `hold` keywords triggers the corresponding plan steps.

**Via external agent (UC-03 — `agentExecute(page, tool, args)`):**

```js
// in Chrome console with WebMCP enabled, or via ChatGPT agent:
await document.modelContext.executeTool("search_inventory", { query: "blue", limit: 10 })
await document.modelContext.executeTool("filter_variants", { options: { color: "Blue" }, maxStock: 5 })
await document.modelContext.executeTool("calculate_shipping", { items: [{sku:"OPS-1002-BLU-M", qty:1}], zone: 4, service: "ground" })
await document.modelContext.executeTool("hold_order", { lineItems: [{sku:"OPS-1002-BLU-M", qty:1}], ttlMinutes: 15 })
await document.modelContext.executeTool("confirm_fulfillment", { holdId: "HOLD-XXXXXXXX" })
```

Each returns the WebMCP result shape:

```json
{
  "content": [{ "type": "text", "text": "<=4000 chars, untrusted marker prefix" }],
  "structuredContent": { "ok": true, "data": { /* typed output */ } },
  "isError": false
}
```

Errors always resolve with `isError: true` and `structuredContent.error.code` ∈ `INVALID_INPUT | NOT_FOUND | CONFLICT | EXPIRED | NEEDS_CONFIRMATION | TOOL_ABORTED | DEGRADED` (`src/engine/types.ts:10-18`).

---

### Use Case 3 — Shipping Quote & Declarative Form (MAN-02)

1.  Click the **Shipping** tab.
2.  If you came from Batch with selected SKUs, the quote may already be visible (the last `calculate_shipping` result). If not, you see: `No shipping quote yet — run a batch or use the declarative form below.` (`src/ui/screens/ShippingScreen.tsx:32-34`).
3.  **Quote card** (when present) shows:
    - `Zone 4 · Service ground` + `total_weight_g` + `total_cents` (`$XX.XX`)
    - Surcharges list (or `No surcharges`)
    - Excluded variants with reason, if any
    - **Show breakdown (N rules)** button — toggles `explain[]` (≤12 lines, one sentence per rule)
4.  **Declarative form** (always visible, `aria-label="Shipping calculator (declarative WebMCP form)"`):
    - `Zone` select (1–5, default 4 `Cross-country`) — has `tooldescription="Shipping zone 1–5; 4 is the demo default"`
    - `Service` select (`ground`/`expedited`/`overnight`) — `tooldescription="Service level…"`
    - `SKUs` text input (comma-separated, 1–50, placeholder = first 3 `resultSkus` or `OPS-1042-BLU-M, OPS-1050-RED-S`) — `tooldescription="Comma-separated variant SKUs…"`
    - The `<form>` itself carries `toolname="calculate_shipping"` (`src/ui/screens/ShippingScreen.tsx:67`) — this is what an agent reading declarative WebMCP sees.
5.  Enter e.g. `OPS-1002-BLU-M, OPS-1005-BLU-M`, keep Zone 4 / Ground, click **Calculate shipping (declarative)**. The button shows `Quoting…` while `executeToolCompat("calculate_shipping", …)` runs (`ShippingScreen.tsx:18-28`). The quote card updates live.
6.  The same call works via imperative `executeTool` — both paths hit `src/engine/domain/shipping.ts` and `POST /api/shipping/quote`.

---

### Use Case 4 — Holds Lifecycle (confirm, release, expired, conflict)

1.  Click the **Holds** tab.
2.  **Empty state** (no holds): `No holds yet — search and hold variants from the Batch tab.` (`src/ui/screens/HoldsScreen.tsx:109`). If a fulfillment was just committed, a green banner also shows: `Fulfillment FUL-XXXXXXXX confirmed from HOLD-XXXXXXXX — N SKUs, $XX.XX — manual baseline 25 min saved.`
3.  **With holds** (after UC-1 confirm): a table with columns Hold ID (monospace), Items (N SKUs), Status (chip: yellow `held` / green `confirmed` / grey `released`/`expired`), TTL (`expires in MM:SS` or `Expired`), Actions (`Release` + `Confirm`).
4.  **Countdown** ticks every second (`useHoldCountdown`, `HoldsScreen.tsx:11-21`). When `Date.now() > expires_at`, the row shows `Expired — release to clear` and `Confirm` becomes disabled with title `Hold expired — cannot confirm`.
5.  **Release:** click **Release** → `holdsStore.release(holdId)` → row status becomes `released` or disappears from active list.
6.  **Confirm:** click **Confirm** → `executeToolCompat("confirm_fulfillment", { holdId })` (`HoldsScreen.tsx:89-104`):
    - Success → green banner `Fulfillment FUL-… confirmed from HOLD-…` appears. The hold status becomes `confirmed`.
    - Failure shapes (all resolve, never throw):
      - `CONFLICT` — confirming twice
      - `NOT_FOUND` — unknown `holdId`
      - `EXPIRED` — past TTL
7.  **Persistence:** holds are client-owned in `localStorage` key `opsflow.holds.v1` (`src/engine/domain/holdsStore.ts`). Reload the page — holds survive. Clearing `localStorage` clears holds (the E2E fixture does this before every test — `design_documents/e2e-testing/strategy.md:108`).

---

### Use Case 5 — Degraded Operation (offline / API blocked)

1.  **Force degraded locally:** `RES_FORCED_DEGRADED=1 npm run dev` or `RES_FORCED_DEGRADED=1 npm run demo:offline` (`master_blueprint_entry.md:636`, NFR-03).
2.  **Simulate in browser:** open DevTools → Network → block `**/api/**` (as the E2E suite does in `06-degraded.spec.ts` — UC-10).
3.  Re-run any goal from UC-1. The full chain **still completes** from the in-browser catalog (`data/catalog.json`).
4.  A **Degraded banner** appears at the top (`src/ui/components/DegradedBanner.tsx` — FR-18) and each affected timeline step shows a `degraded` chip (`degraded: true` on the envelope). Data is still correct (same SKUs), not a placeholder.

---

### Use Case 6 — Verify WebMCP Features (for judges / recording)

1.  **Tool Inspector:** click **Inspect tools (5)** in the header → panel `Registered WebMCP tools` appears (`src/ui/components/ToolInspector.tsx`). It calls `document.modelContext.getTools()` live and renders 5 cards with `name`, `description`, `annotations`, and pretty-printed `inputSchema`. Verify it shows exactly `search_inventory`, `filter_variants`, `calculate_shipping`, `hold_order`, `confirm_fulfillment` with their frozen `readOnlyHint` etc. (`master_blueprint_entry.md:506-527`).
2.  **Co-execution timeline:** every tool call emits `started → done/error` `EventEnvelope`s (`src/engine/envelopes.ts`, `src/platform/transport`). The timeline shows exact validated args.
3.  **Headers:** any response must carry `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)` (MAN-03). Check in DevTools → Network → any request → Response Headers, or:

    ```bash
    curl -sI http://localhost:5173 | grep -Ei "origin-agent-cluster|permissions-policy"
    ```

4.  **Health endpoint:**

    ```bash
    curl -s http://localhost:5173/api/health | python3 -m json.tool
    # {"ok": true, "version": "1.0.0", "mode": "live", "origin_isolated": true,
    #  "planner": "deterministic", "catalog": {"products": 60, "variants": 200, "synthetic": true}}
    ```

5.  **Fallback banner:** disable WebMCP (use a browser without the flag) → yellow `WebMCP not detected` banner with two enablement paths appears, but the app remains fully usable via the in-page console (FR-17).

---

## 8. Tool Reference

All five tools are registered in `src/webmcp/register.ts` (the **only** `registerTool` call site — MAN-01) with schemas in `src/webmcp/schemas.ts`, executed via `src/webmcp/runTool.ts` (validate → truncate → signal check → domain → envelope → `ToolOutcome`).

| Tool | `annotations` | Input | Output | Confirm? | Limits |
|---|---|---|---|---|---|
| `search_inventory` | `readOnlyHint:true, openWorldHint:false` | `SearchInventoryInput { query: string (≤200), inStockOnly?: boolean, limit?: number }` | `SearchInventoryOutput { matches: VariantMatch[], total, truncated, query_echo }` | no | `query` truncated to 200 chars |
| `filter_variants` | `readOnlyHint:true, openWorldHint:false` | `FilterVariantsInput { skuPrefix? (≤32), options? {size,color}, maxPriceCents?, minStock?, maxStock?, limit? }` | `FilterVariantsOutput { matches, total, applied: string[], from_result_set: boolean }` | no | narrows current result set |
| `calculate_shipping` | `readOnlyHint:true, openWorldHint:false` | `CalculateShippingInput { items: LineItem[] (1–50), zone: 1..5, service: ground|expedited|overnight }` | `ShippingQuote { total_cents, base_rate_cents, surcharges[], explain[], excluded[] }` | no | result text ≤4000 chars, untrusted marker |
| `hold_order` | `readOnlyHint:false, destructiveHint:false, idempotentHint:false, openWorldHint:false` | `HoldOrderInput { lineItems: LineItem[] (1–50), ttlMinutes: 1..120, note? (≤200) }` | `HoldOrderOutput { hold: Hold, requires_confirmation: true }` | **yes** — dialog must be confirmed | abort via `options.signal` → `TOOL_ABORTED` |
| `confirm_fulfillment` | `readOnlyHint:false, destructiveHint:false, idempotentHint:true, openWorldHint:false` | `ConfirmFulfillmentInput { holdId: string (≤32) }` | `ConfirmFulfillmentOutput { fulfillment: Fulfillment, hold: Hold }` | **yes** | `NOT_FOUND` / `CONFLICT` / `EXPIRED` typed errors |

All `execute` callbacks **never throw** — failures resolve with `{ isError: true, structuredContent: { ok:false, error:{code,message} } }` (FR-07/FR-08).

---

## 9. Commands to Run Before Deploying to Vercel

Run from the entry root. The **minimal gate** (`scripts/gate.ts`) already orchestrates the critical checks, but the full pre-deploy checklist below is what to run when you have time.

### Quick gate (2–5 min, the one to run right before `vercel --prod`)

```bash
# 1. Clean-clone + type + build + unit + hygiene — the deploy gate itself
npm run gate
# Exit 0 → 10/10 passed, ready to submit. Non-zero → first failure with hint.
# Gate checks (scripts/gate.ts:1-104):
#  [1/10] clean build          — npm ci && npm run build with no .env (NFR-11)
#  [2/10] MAN-01 registerTool  — rg modelContext.registerTool → exactly 1 hit in src/
#  [3/10] MAN-02 toolname      — rg toolname → exactly 1 hit (ShippingScreen.tsx)
#  [4/10] MAN-04 licence       — LICENSE exists and head is "MIT License"
#  [5/10] hygiene              — npx vite-node src/provenance/submit/cli.ts hygiene → secrets:0, license:MIT
#  [6/10] MAN-03 headers       — HEAD OPSFLOW_URL → Origin-Agent-Cluster:?1 + Permissions-Policy:tools=(self)
#  [7/10] MAN-05 health        — GET OPSFLOW_URL/api/health → {ok:true, version:"1.0.0", catalog:{60,200,true}}
#  [8/10] MAN-06/07 script + submission — script.md & submission.md exist, ≥4 "## " headings
#  [9/10] staleness            — track status --strict (deck/script/submission fresh vs plan)
#  [10/10] summary             — prints Live URL + next steps
```

> `OPSFLOW_URL` for steps 6–7: set `OPSFLOW_URL=https://<project>.vercel.app npm run gate` or ensure `docs/submission-checklist.md` contains the URL (the gate reads it as fallback). For a **local-only** gate before the first deploy, steps 6–7 will fail as expected — run the local checks below instead.

### Full local checklist (run when you have 10–15 min)

```bash
# A. Types
npm run typecheck
# Known: the repo is not tsc-green due to pre-existing strict-mode errors
# (strategy.md §6: "npx tsc --noEmit is not green" — concentrated in tests and noUncheckedIndexedAccess).
# What matters: vite build must be green — see next line. Do not block deploy on tsc.

# B. Build (must be green)
npm run build
# Expected: "✓ built in ~300ms" + dist/assets/*.js. The INEFFECTIVE_DYNAMIC_IMPORT warning is expected.

# C. Unit suite (must be green — 164 tests, ~8s)
npm test
# or targeted:
npm run test:ui        # vitest --project ui
npm run test:tools     # vitest tests/tools

# D. Doctor (must be ok — 8 chassis components)
npm run doctor
# Expected: {"ok": true, checks: [... 8 pass ...], "planner-credentials": "warn" if no Vertex creds — OK locally}

# E. Hygiene (must be clean — secrets 0, MIT)
npm run submit:hygiene
# Writes hygiene-report.json + .md — check hygiene-report.json: secrets:0, license:"MIT", overall:"clean"

# F. Bench (informational — NFR-02: p95 <300ms)
npm run bench:tools
# Expected: all 5 tools p95 << 1ms (e.g. search_inventory p95=0.35ms)

# G. Offline demo (must succeed — NFR-03)
npm run demo:offline
# Expected: "published 14 envelopes trace_id=...  zero network requests"

# H. Track (must be fresh)
npm run track
# Expected: all rows status:"fresh" — no stale deck/script/submission vs plan

# I. E2E (must be green when time allows — ~2-3 min, needs Playwright browsers)
npm run test:e2e
# Runs 2 projects: live (5174, with API) + static (4174, production bundle, no API)
# Variants:
npm run test:e2e -- --project=live   # only full-stack
npm run test:e2e -- --headed         # watch the browser
npx playwright show-report reports/e2e  # HTML report
```

### Quick reference table

| Command | What it proves | Must be green before deploy? |
|---|---|---|
| `npm run typecheck` | TS strict errors — informational (known failures) | No — informational only |
| `npm run build` | Production bundle compiles | **Yes** |
| `npm test` | 164 unit/integration tests | **Yes** |
| `npm run test:e2e` | 13 use cases via real Chromium (live + static) | **Yes** if time; otherwise after first deploy |
| `npm run doctor` | Chassis manifest + planner creds | **Yes** (`ok:true`) |
| `npm run submit:hygiene` | Zero secrets + MIT license | **Yes** (`overall:clean`) |
| `npm run bench:tools` | p95 <300ms per tool | Informational |
| `npm run demo:offline` | Offline replay works | **Yes** |
| `npm run track` | No stale artifacts | **Yes** |
| `npm run gate` | The 10-step submission gate | **Yes** (the final gate) |

### One-liner for CI / pre-push

```bash
npm run build && npm test && npm run doctor && npm run submit:hygiene && npm run track
# add  && npm run test:e2e  when you have the browsers installed (npx playwright install)
```

---

## 10. Deploy to Vercel

```bash
# one-time
npx vercel link          # creates .vercel/project.json (gitignored — NFR-01, never commit)

# every deploy
npx vercel --prod        # deploy static SPA + api/ functions to production

# verify (two commands, exactly as in README.md:123-126 and master_blueprint_entry.md:244-260)
curl -sI "$OPSFLOW_URL" | grep -Ei "origin-agent-cluster|permissions-policy"
# expected: origin-agent-cluster: ?1
# expected: permissions-policy: tools=(self)

curl -s "$OPSFLOW_URL/api/health" | python3 -m json.tool
# expected: {"ok":true,"version":"1.0.0","mode":"live","origin_isolated":true,"planner":"...","catalog":{"products":60,"variants":200,"synthetic":true}}

# or the scripted verifier (same checks, JSON output, retry on transient failure)
npx vite-node scripts/deploy-verify.ts -- https://<project>.vercel.app
node scripts/verify-headers.mjs https://<project>.vercel.app
```

**Planner credentials (optional, server-side only):**

```bash
npx vercel env add GOOGLE_VERTEX_PROJECT production      # GCP project id
npx vercel env add GOOGLE_VERTEX_LOCATION production     # e.g. us-central1 (optional, default us-central1)
npx vercel env add GOOGLE_VERTEX_CREDENTIALS production  # service-account JSON, raw or base64
# Service account needs only `roles/aiplatform.user` (Vertex AI User).
# If unset, /api/agent/plan falls back to deterministic — app is fully functional without them.
# Credentials are read only in api/_vertex.ts, never in the client bundle (NFR-01 verified by tests/e2e/09-production-bundle.static.spec.ts).
```

> **Freeze:** after `Sep 3 2026 13:00 PDT / 20:00 UTC` do not `vercel --prod` again on the production project. Fork to keep building (`README.md:119`).

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npm run typecheck` fails | Known strict-mode debt (`strategy.md §6`) | Ignore for deploy; `npm run build` is the real gate. |
| `npm run doctor` warns `planner-credentials` | No Vertex creds locally | Expected — `warn` is OK locally; production sets `GOOGLE_VERTEX_*` via `vercel env add`. |
| E2E: `api/* 404` or degraded chip always on | Dev server started without the `opsflow-api-dev-server` plugin (e.g. ran `vite` from wrong directory) | Run from entry root: `npx vite --port 5174` via `npm run dev` or `playwright.config.ts` `webServer`. |
| Inspector shows 0 tools | WebMCP flag off / not in ChatGPT in-app browser | Enable `chrome://flags/#enable-webmcp-testing` + restart, or use ChatGPT desktop app. |
| `npm run gate` fails at `[6/10]` / `[7/10]` | `OPSFLOW_URL` not set and no URL in `docs/submission-checklist.md` | Set `OPSFLOW_URL=https://<url> npm run gate` or write the URL to `docs/submission-checklist.md` after first deploy. |
| `hygiene-report.json` shows `overall: dirty` | Secrets scan hit (e.g. pasted key) or missing LICENSE | Remove the secret, ensure `LICENSE` at repo root starts with `MIT License`, re-run `npm run submit:hygiene`. |
| `Confirm` button disabled on Holds tab | Hold TTL expired | Expected — row shows `Expired — release to clear`. Create a fresh hold. |
| `Selection capped at 50 SKUs` | Selected 50 SKUs | Deselect some to add others — `config/engine.json:tools.max_items: 50`. |

---

*Generated for OpsFlow v1.0.0 — covers `package.json:11-34`, `vite.config.ts:11-84`, `vercel.json:3-9`, `src/ui/App.tsx`, `src/ui/screens/*`, `src/webmcp/*`, `src/engine/types.ts`, `scripts/gate.ts`, `design_documents/e2e-testing/strategy.md`, and `README.md`. Keep this file in sync via `npm run track` (`track status --strict` will flag staleness).*
