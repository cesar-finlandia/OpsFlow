# Provenance & Disclosure

> Generated from `assembly.manifest.json` — do not hand-edit accuracy; polish wording only if needed. Verbatim reuse by DECKGEN-02 / SUBMIT-02 / FAQDEF-02 (contract 8).

This project reuses **8** component(s) from the Hackathon Chassis Repository (`v0.0.0-` / `LICENSE: MIT`).

## Reused components (8)

- **resilience** — Resilience & Demo-Proofing Layer (`RES-*`) — Generic `withResilience` wrapper + `DegradedResult` + golden cache.
- **platform** — Platform Layer (`DEP/TRN/UI`) — One-command deploy, typed streaming bus, 3 distinct UI themes.
- **ideation** — Ideation & Pitch Tooling (`PIT/IDEA/RETRO`) — PIT deck skeleton, IDEA worksheet, RETRO template + 4 Hour 48–72 auto-populators `ideation/deckgen/script/demodrive/faqdef`.
- **context** — Context & Conversation Buffer (`CTX-*`) — Provider-agnostic message buffer + pluggable token counter.
- **dev-tooling** — Local Dev & Verification (`MOCK/EVAL/DOCTOR/TRACK/BENCH`) — `dev-tooling/mock`, `eval`, `doctor`, `track`, `bench`.
- **data** — Synthetic Demo-Data Generator (`DATA-*`) — On-demand synthetic data generation with `synthetic:true` marker.
- **cost** — Cost & Usage Guardrail (`COST-*`) — Token/request metering + budget warnings, reuses `CTX-02` counter.
- **provenance** — Provenance & Disclosure (`PROV/SUBMIT`) — Disclosure generator (`prov`) + submission formatter + repo hygiene guard (`submit`).

## How to cite

Cite the chassis repository as prior scaffolding per `XCUT-01` / `LICENSE`. Full disclosure source: `assembly.manifest.json` (`manifest_version 1.0.0`, `chassis_version v0.0.0-unresolved`).

_Generated at 2026-09-01T16:53:25.512Z from manifest hash e0ab7cad191ac08b824ef8e1afeea9d2305872bc45a5140fb2972d08c8c0d347._
