// Requirement IDs: SCRIPT-01, SCRIPT-REU-02, PROFILE-05, RES-04, GOV-RES-02,
// XCUT-08 — DP-D2a §4.1/§6.6/§7.
//
// timing.yaml (alias timing.json) → validated TimingConfig + cumulative mm:ss
// windows. Section boundaries and total target length are CONFIGURATION, never
// hardcoded (SCRIPT-REU-02): adding a 5th section is a config-only change.
//
// Error semantics differ from other configs on purpose (§6.6): timing.yaml is
// human-authored and wrong timestamps would violate SCRIPT-AC-01, so a malformed
// or sum-mismatched file is a hard TimingValidationError that the CLI maps to
// exit 1 ("ERROR: timing.yaml invalid at <path>: <message>. Fix sum == total.")
// instead of the warn+safe-default degradation used elsewhere.
//
// No yaml npm dependency exists in this repo, so parseTimingYaml implements the
// small documented subset of the timing file shape (top-level scalars plus a
// sections list of flow mappings `- { k: v, ... }` and their block-style
// equivalent). Anything it cannot understand fails validation loudly rather
// than being silently skipped.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../resilience/index.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..");

/** En-dash separator used between mm:ss window bounds, exactly as in §4.1. */
export const WINDOW_SEPARATOR = "–";

//#region Types (shape mirrors contracts/script-timing.schema.json — $ref, never re-defined)

/** One ordered script section; minutes is 0.1..10 per the contract. */
export interface TimingSection {
  id: string;
  title: string;
  minutes: number;
  live?: boolean;
  description?: string;
}

/** Validated timing config. total_minutes may be null → derive downstream. */
export interface TimingConfig {
  version: "1.0.0";
  total_minutes: number | null;
  sections: TimingSection[];
}

/** Cumulative mm:ss window for one section, e.g. start "00:00", end "00:30". */
export interface TimingWindow {
  id: string;
  title: string;
  minutes: number;
  live: boolean;
  /** Section start as mm:ss (e.g. "00:30"). */
  start: string;
  /** Section end == next start; last end equals the total (e.g. "03:00"). */
  end: string;
  /** Display form `${start}${WINDOW_SEPARATOR}${end}` (e.g. "00:00–00:30"). */
  window: string;
}

/** SCRIPT signal: timing rejected pre-generation — CLI maps to exit 1 (§6.6). */
export class TimingValidationError extends Error {
  readonly path: string;
  readonly errors: Array<{ path: string; message: string; code: string }>;

  constructor(message: string, timingPath: string, errors: Array<{ path: string; message: string; code: string }>) {
    super(message);
    this.name = "TimingValidationError";
    this.path = timingPath;
    this.errors = errors;
  }
}

//#endregion

//#region Minimal YAML-subset parser for the documented timing file shape

/** Parse a scalar token: quoted string, null/true/false, or number; else raw string. */
function parseScalar(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return null;
  if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) || (t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
    return t.slice(1, -1);
  }
  if (t === "null" || t === "~") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return t;
}

/** Strip a trailing comment that is outside of any quotes. */
function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(line.charAt(i - 1)))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/** Split a flow-mapping body `{ k: v, k2: "v,2" }` on top-level commas. */
function splitFlowEntries(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let current = "";
  for (const ch of body) {
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (!inSingle && !inDouble) {
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** Parse `k: v, k2: "v2"` pairs into an object. */
function parseFlowMapping(body: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const entry of splitFlowEntries(body)) {
    const idx = entry.indexOf(":");
    if (idx <= 0) throw new Error(`flow mapping entry is not key: value — "${entry.trim()}"`);
    const key = entry.slice(0, idx).trim();
    obj[key] = parseScalar(entry.slice(idx + 1));
  }
  return obj;
}

interface YamlListItem {
  /** First `- key: value` line's parsed pair (block style), if any. */
  first?: [string, unknown];
  /** Parsed object for `- { ... }` flow style. */
  flow?: Record<string, unknown>;
  /** Subsequent `key: value` continuation lines (block style). */
  rest: Array<[string, unknown]>;
}

/**
 * Parse the small YAML subset used by timing files: top-level `key: value`
 * scalars plus a `sections:` list whose items are either flow mappings
 * (`- { id: problem, minutes: <float> }`) or block-style entries (`- id: problem`
 * followed by more-indented `key: value` lines). Anything else throws so the
 * failure surfaces as a loud validation error instead of silent data loss.
 */
export function parseTimingYaml(text: string): unknown {
  const lines = text.split(/\r?\n/).map(stripComment);
  const doc: Record<string, unknown> = {};
  const itemsByKey = new Map<string, YamlListItem[]>();
  let listKey: string | null = null;
  let videoPolicy: Record<string, unknown> | null = null;
  let inVideoPolicy = false;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").replace(/\t/g, "  ");
    if (!line.trim()) continue;

    const listMatch = /^(\s*)-\s+(.*)$/.exec(line);
    if (listMatch && listKey !== null) {
      const bucket = itemsByKey.get(listKey) ?? [];
      bucket.push(parseListLine(listMatch[2] ?? ""));
      itemsByKey.set(listKey, bucket);
      // any indented content after a list item ends video_policy scope
      inVideoPolicy = false;
      continue;
    }
    if (listMatch && listKey === null) {
      throw new Error(`list item at line ${i + 1} appears before any list key`);
    }

    const kv = /^(\s*)([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`cannot parse line ${i + 1}: "${line.trim()}"`);
    const [, indent, key, restRaw] = kv as unknown as [string, string, string, string];
    if (indent.length > 0) {
      if (inVideoPolicy && videoPolicy) {
        videoPolicy[key] = parseScalar(restRaw);
        continue;
      }
      // Continuation of the most recent block-style list item.
      const bucket = listKey ? itemsByKey.get(listKey) : undefined;
      const last = bucket?.[bucket.length - 1];
      if (!last || last.flow) throw new Error(`unexpected indented key "${key}" at line ${i + 1}`);
      last.rest.push([key, parseScalar(restRaw)]);
      continue;
    }
    // top-level key
    inVideoPolicy = false;
    if (restRaw.trim() === "") {
      // Block header: either list (segments/sections) or nested map (video_policy)
      if (key === "video_policy") {
        videoPolicy = {};
        doc[key] = videoPolicy;
        inVideoPolicy = true;
        // do not set listKey for video_policy; it's a map, not a list
        continue;
      }
      // Block list header, e.g. `sections:` or `segments:`.
      listKey = key;
      if (!itemsByKey.has(listKey)) itemsByKey.set(listKey, []);
      continue;
    }
    // Handle inline flow map for video_policy: { max_seconds: 180, ... }
    if (key === "video_policy" && restRaw.trim().startsWith("{")) {
      try { doc[key] = parseFlowMapping(restRaw.trim().slice(1, -1)); } catch { doc[key] = parseScalar(restRaw); }
      continue;
    }
    doc[key] = parseScalar(restRaw);
  }

  for (const [k, items] of itemsByKey.entries()) {
    doc[k] = items.map(materializeItem);
  }
  return doc;
}

function parseListLine(rest: string): YamlListItem {
  const flowMatch = /^\{(.*)\}$/.exec(rest.trim());
  if (flowMatch) return { flow: parseFlowMapping(flowMatch[1] ?? ""), rest: [] };
  const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(rest);
  if (!kv) throw new Error(`cannot parse list item entry: "${rest.trim()}"`);
  return { first: [kv[1] ?? "", parseScalar(kv[2] ?? "")], rest: [] };
}

function materializeItem(item: YamlListItem): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  if (item.flow) return item.flow;
  if (item.first) obj[item.first[0]] = item.first[1];
  for (const [k, v] of item.rest) obj[k] = v;
  return obj;
}

//#endregion

//#region RES-04 validation + arithmetic rules (§4.1)

let timingSchemaCache: object | null = null;

/** contracts/script-timing.schema.json — owned here (M13); consumers $ref it. */
export function loadTimingSchema(): object {
  return (timingSchemaCache ??= JSON.parse(
    readFileSync(join(REPO_ROOT, "contracts", "script-timing.schema.json"), "utf8"),
  ) as object);
}

/** Round to one decimal (the convention for minutes values). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Sum of section minutes rounded to one decimal. */
export function sumSectionMinutes(sections: TimingSection[]): number {
  return round1(sections.reduce((s, sec) => s + sec.minutes, 0));
}

function collectSchemaErrors(result: { valid: boolean; errors: Array<{ path: string; message: string; code: string }> }):
    Array<{ path: string; message: string; code: string }> {
  return result.errors.map((e) => ({ path: e.path, message: e.message, code: e.code }));
}

/**
 * Validate a parsed timing document: RES-04 against
 * contracts/script-timing.schema.json plus the arithmetic rule the schema
 * cannot express — when total_minutes is non-null it must equal
 * sum(sections[].minutes) within ±0.01 after rounding to one decimal.
 * Throws TimingValidationError on any failure (CLI maps to exit 1, §6.6).
 */
export function validateTiming(doc: unknown, timingPath: string): TimingConfig {
  const result = validate(loadTimingSchema(), doc);
  if (!result.valid || typeof doc !== "object" || doc === null) {
    const first = result.errors[0];
    throw new TimingValidationError(
      first ? `${first.path}: ${first.message}` : "failed RES-04 validation",
      timingPath,
      collectSchemaErrors(result),
    );
  }
  const cfg = doc as unknown as TimingConfig;
  if (cfg.total_minutes != null) {
    const rawSum = cfg.sections.reduce((s, sec) => s + sec.minutes, 0);
    const sum = sumSectionMinutes(cfg.sections);
    // Allow precise totals like 2.75 (165s) where rounded sum 2.8 differs by 0.05 from exact 2.75;
    // accept either exact raw sum or rounded sum within tolerance.
    if (Math.abs(rawSum - cfg.total_minutes) > 0.01 && Math.abs(sum - cfg.total_minutes) > 0.01) {
      throw new TimingValidationError(
        `timing validation: sum ${sum.toFixed(1)} != total ${Number(cfg.total_minutes).toFixed(1)} — adjust sections to sum to total`,
        timingPath,
        [{ path: "/total_minutes", message: `sum ${sum.toFixed(1)} != total ${cfg.total_minutes}`, code: "sum-mismatch" }],
      );
    }
  }
  return cfg;
}

/**
 * loadTiming(path|null) — read + parse + validate a timing config.
 *
 * - null/undefined → null (caller derives the total from profile/fallback).
 * - `.json` files (or the timing.json alias) are parsed as JSON; everything
 *   else goes through the YAML subset parser.
 * - Any read/parse/validation failure throws TimingValidationError carrying the
 *   exact file path — §6.6 exit-1 semantics because wrong timestamps would
 *   violate SCRIPT-AC-01 (deliberately NOT warn+default like other configs).
 */
export function loadTiming(path: string | null | undefined): TimingConfig | null {
  if (path == null || !path.trim()) return null;
  const resolved = path.trim();
  try {
    const text = readFileSync(resolved, "utf8");
    let parsed: unknown = /\.json$/i.test(resolved) ? JSON.parse(text) : parseTimingYaml(text);
    // DP-PITCH §6.1 compatibility: map segments/duration_s/total_s to sections/minutes/total_minutes
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const doc = parsed as Record<string, unknown>;
      if (doc["segments"] && !doc["sections"]) {
        const segs = doc["segments"] as Array<Record<string, unknown>>;
        doc["sections"] = segs.map((s) => ({
          id: s["id"],
          title: s["title"],
          minutes: typeof s["minutes"] === "number" ? s["minutes"] : typeof s["duration_s"] === "number" ? (s["duration_s"] as number) / 60 : 0.5,
          ...(typeof s["live"] === "boolean" ? { live: s["live"] } : {}),
          ...(typeof s["description"] === "string" ? { description: s["description"] } : {}),
        }));
        // Ensure coexecution is live if none marked
        const secs = doc["sections"] as Array<Record<string, unknown>>;
        if (!secs.some((x) => x["live"] === true)) {
          const cand = secs.find((x) => x["id"] === "coexecution") ?? secs[1];
          if (cand) (cand as Record<string, unknown>)["live"] = true;
        }
      }
      if (doc["total_s"] != null && doc["total_minutes"] == null) {
        const ts = doc["total_s"] as number;
        if (typeof ts === "number") doc["total_minutes"] = ts / 60;
      }
      // Handle total_s + video_policy target consistency
      if (doc["total_minutes"] == null && doc["video_policy"] && typeof doc["video_policy"] === "object") {
        const vp = doc["video_policy"] as Record<string, unknown>;
        if (typeof vp["target_seconds"] === "number") doc["total_minutes"] = (vp["target_seconds"] as number) / 60;
      }
    }
    return validateTiming(parsed, resolved);
  } catch (err) {
    if (err instanceof TimingValidationError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new TimingValidationError(msg, resolved, [{ path: "/", message: msg, code: "read-or-parse" }]);
  }
}

//#endregion

//#region Cumulative mm:ss window math (SCRIPT-AC-01)

/** Format whole seconds as mm:ss (minutes zero-padded to 2 digits). */
export function formatMMSS(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * computeWindows(timing) — cumulative mm:ss windows per section.
 *
 * Boundaries are the cumulative sum of section minutes (float minutes ×60,
 * rounded to whole seconds at each boundary — one-decimal-minute inputs land
 * exactly); the last window always ends at the total (e.g. "03:00"). Bounds
 * are joined with the en-dash in `window` exactly as in the §4.1 examples.
 * Adding/reordering sections changes the output with zero code changes
 * (SCRIPT-REU-02) — no hardcoded minutes or titles anywhere below.
 */
export function computeWindows(timing: TimingConfig): TimingWindow[] {
  // Cumulative minute boundaries; boundary i is where section i ends.
  const boundaries: number[] = [0];
  let acc = 0;
  for (const sec of timing.sections) {
    acc += sec.minutes;
    boundaries.push(acc);
  }
  return timing.sections.map((sec, i) => {
    // boundaries has length sections.length + 1, so these indices are always
    // in range; ?? guards only satisfy noUncheckedIndexedAccess.
    const startMin = boundaries[i] ?? 0;
    const endMin = boundaries[i + 1] ?? acc;
    const startS = formatMMSS(startMin * 60);
    const endS = formatMMSS(endMin * 60);
    return {
      id: sec.id,
      title: sec.title,
      minutes: sec.minutes,
      live: sec.live === true,
      start: startS,
      end: endS,
      window: `${startS}${WINDOW_SEPARATOR}${endS}`,
    };
  });
}

//#endregion
