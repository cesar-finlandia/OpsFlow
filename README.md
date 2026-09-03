# OpsFlow — WebMCP Agent-Native Fulfillment Console

Turn 25-minute fulfillment hunts into ~3-minute agent co-executed flows.

> License: [MIT License](./LICENSE)

## What it is

Maya is an ops specialist who today spends ~25 minutes per batch hunting SKUs, filtering variants, quoting shipping, placing holds, and confirming fulfillment across tabs and spreadsheets. With OpsFlow, an agent and Maya co-execute the same chain in ~3 minutes: **search_inventory → filter_variants → calculate_shipping → hold_order → confirm_fulfillment**. Maya stays in control — holds and confirms require explicit confirmation — while the agent handles the imperative tool orchestration. Every step emits an EventEnvelope so the Co-Execution Timeline stays inspectable.

## WebMCP surface

Five imperative tools registered before first paint from `src/webmcp/register.ts` (MAN-01):

- `search_inventory` — readOnlyHint
- `filter_variants` — readOnlyHint
- `calculate_shipping` — readOnlyHint
- `hold_order` — confirm required
- `confirm_fulfillment` — confirm required

Imperative registration (literal snippet copied from `src/webmcp/register.ts`):

```ts
document.modelContext.registerTool({ name, description, inputSchema, execute })
```

Declarative form (MAN-02) in `src/ui/screens/ShippingScreen.tsx`:

```tsx
<form toolname="calculate_shipping" ...>
```
The ShippingScreen form is annotated with `toolname="calculate_shipping"` and per-field `tooldescription` so a WebMCP-aware agent can invoke `calculate_shipping` without imperative JS.

Origin isolation and Permissions Policy (MAN-03) via `vercel.json` headers:

- `Origin-Agent-Cluster: ?1`
- `Permissions-Policy: tools=(self)`

No cross-origin iframe exists, so `allow="tools"` is deliberately unused.

Curl proof (live):

```bash
curl -sI "$OPSFLOW_URL" | grep -Ei "origin-agent-cluster|permissions-policy"
# origin-agent-cluster: ?1
# permissions-policy: tools=(self)
```

Enablement paths:

- **ChatGPT desktop app in-app browser** — WebMCP by default, no flag required.
- **Google Chrome 149+** — enable `chrome://flags/#enable-webmcp-testing` and restart the browser.

Debug with the Model Context Tool Inspector extension:

- Extension id `gbpdfapgefenggkahomfgkhfehlcenpd` — shows the five registered tools and declarative form in the inspected page.

## Spin-up

No `.env` required (NFR-11). Clean-clone build works with no secrets:

```bash
npm install
npm run dev    # Vite dev server, default http://localhost:5173
npm run build  # production build to dist/
```

The app runs fully with no credentials at all: the planner falls back to the
deterministic keyword planner, which produces the same `ToolPlan` shape, and the
UI labels which planner ran. All five WebMCP tools, all three screens and the
whole `search → filter → quote → hold → confirm` chain work in this mode.

### Testing

```bash
npm test          # unit + integration suite (Vitest)
npm run test:e2e  # end-to-end browser suite (Playwright) — starts its own servers
```

The E2E suite drives a real Chromium against both the dev server (with the `api/`
routes served) and the production bundle, and covers every use case in the design
plans. The strategy, the use-case catalogue and the requirement traceability
matrix live in [`design_documents/e2e-testing/`](./design_documents/e2e-testing/strategy.md).

## Deploy

Deploy target is Vercel (static SPA + `api/` serverless functions). Verbatim steps from DP-SHIP §2.0.2 / §5.2:

```bash
npx vercel link          # one-time: creates .vercel/project.json (gitignored)
npx vercel --prod        # deploy static SPA + api/ functions to production
```

### Planner credentials (optional)

The planner reaches **Gemini 3.6 Flash through Vertex AI**, not through a
Generative Language API key. A long-lived API key cannot be scoped, cannot be
rotated without a redeploy, and is one copy-paste away from a public repository;
Vertex mints a short-lived OAuth token from a service account instead, so nothing
durable is ever in flight and the credential is scoped to one project.

Set three server-side environment variables to enable it:

```bash
npx vercel env add GOOGLE_VERTEX_PROJECT production      # your GCP project id
npx vercel env add GOOGLE_VERTEX_LOCATION production     # e.g. us-central1 (optional, default us-central1)
npx vercel env add GOOGLE_VERTEX_CREDENTIALS production  # service-account JSON, raw or base64
```

The service account needs only the **Vertex AI User** role
(`roles/aiplatform.user`). If none of these are set, `/api/agent/plan` answers
immediately from the deterministic planner — the app is fully functional without
them, which is what makes a clean clone runnable with no `.env` (NFR-11).

Notes:

- `npx vercel link` creates `.vercel/project.json`, which `.gitignore` excludes (NFR-01) and is never committed.
- Credentials are read only in `api/_vertex.ts`, server-side. They never reach the client bundle; `tests/e2e/09-production-bundle.static.spec.ts` asserts the built JS contains no credential-shaped string.
- After the freeze (Sep 3 13:00 PDT / 20:00 UTC → Sep 21) do not run `npx vercel --prod` again against the production project; continued work happens on a fork.

Verify headers and health after deploy:

```bash
curl -sI "$OPSFLOW_URL" | grep -Ei "origin-agent-cluster|permissions-policy"
curl -s "$OPSFLOW_URL/api/health" | python3 -m json.tool
```

## Holds are client-owned

There is no holds endpoint by design. Holds and fulfillments are managed entirely in the browser via the `holdsStore` singleton and persisted to `localStorage` key `opsflow.holds.v1`. This keeps judge review simple: no server-side hold state to reconcile, no auth to configure, and no extra API route beyond the five listed in §3.1. The Shipping and Holds screens read from the same store, and fulfillment confirmation mutates local state only.

## Disclosure & reuse

See [disclosure.md](./disclosure.md) for full chassis provenance (generated via `npx vite-node src/provenance/prov/cli.ts generate --manifest assembly.manifest.json --out disclosure.md`).

The chassis `src/` was never edited — all composition is via the public surfaces declared in `assembly.manifest.json`. No chassis file was forked or patched; reuse is disclosed per the hackathon New & Existing rule.

## Links

- **Live URL:** `https://opsflow-2026-09-webmcp.vercel.app` 
- **Repository:** `https://github.com/cesar-finlandia/OpsFlow` _(placeholder — public repo with MIT LICENSE detectable in GitHub About box)_
- **Demo video (YouTube, <3 min, public):** `https://youtu.be/lMuggGD8KcM` _(placeholder — public YouTube link with audio covering what was built and how WebMCP was used)_

Placeholders will be replaced with the verified production URL, public repo URL, and public YouTube video before submission. All three URLs are frozen from Sep 3 13:00 PDT (20:00 UTC) until judging ends Sep 21; no redeploys or video edits after the freeze.

