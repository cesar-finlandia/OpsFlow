# Submission Checklist — OpsFlow (DP-SHIP W6)

## Verified Production URL

- Production URL: `https://<project>.vercel.app` (placeholder — replace with verified URL after `npx vercel --prod` and `npm run deploy:verify`)
- Commit hash: `$(git rev-parse HEAD)` (placeholder — fill with `git rev-parse HEAD` output at freeze)
- Deploy date: 2026-09-01 (placeholder — fill with actual deploy date)
- Verifier: _operator name_ (placeholder — fill with verifier name)
- Extractable URL for gate: https://<project>.vercel.app

## Gate Checklist (ten steps — MAN-*/NFR-* tied)

- [ ] [1/10] clean build — NFR-11 — `npm ci && npm run build` succeeds with no `.env`
- [ ] [2/10] MAN-01 registerTool — `rg modelContext.registerTool` exactly 1 hit in `src/` (DP-TOOLS)
- [ ] [3/10] MAN-02 toolname — `rg toolname` exactly 1 hit in `src/` (ShippingScreen.tsx, DP-UI)
- [ ] [4/10] MAN-04 licence — `LICENSE` exists and `head -1` is `MIT License`
- [ ] [5/10] hygiene — NFR-01 + MAN-04 — `npx vite-node src/provenance/submit/cli.ts hygiene` → `secrets: 0`, `license: MIT`
- [ ] [6/10] MAN-03 headers — `fetch HEAD` at `OPSFLOW_URL` asserts `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`
- [ ] [7/10] MAN-05 health — `GET /api/health` asserts `{ok:true, version:"1.0.0", catalog:{products:60, variants:200, synthetic:true}}`
- [ ] [8/10] MAN-06/07 script+submission — `script.md` and `submission.md` exist and `submission.md` has ≥4 `##` headings (DP-PITCH)
- [ ] [9/10] staleness — `track status --strict` (or echo ok if not wired) passes (MAN-09)
- [ ] [10/10] summary — gate prints `gate complete: 10/10` with live URL and Devpost deadline (MAN-08)

## Freeze Notice

Frozen Sep 3 13:00 PDT (20:00 UTC) -> Sep 21. No redeploys; continued work on a fork only.

After the freeze, do not run `npx vercel --prod` against the production project. Continued work happens on a fork (e.g., `opsflow-2026-09-webmcp-postfreeze`) — never force-push to the submitted URL/branch.


