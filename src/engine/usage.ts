// DP-CORE W6 — cost-store writer (§5.5)
import { loadConfig } from "./config.js";

export interface UsageEntry {
  role: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  ts: string;
}

interface CostStore {
  version: string;
  entries: (UsageEntry & { budget_path?: string })[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

function storePath(): string {
  try {
    return loadConfig().cost.store_path;
  } catch {
    return "data/cost-store.json";
  }
}

export function recordUsage(entry: UsageEntry): void {
  try {
    if (isBrowser()) {
      console.warn("[usage] recordUsage called in browser — cost-store write is server-only; entry:", entry);
      return;
    }
    const fs = eval("require")("fs") as typeof import("fs");
    const path = eval("require")("path") as typeof import("path");
    const sp = storePath();
    const full = path.isAbsolute(sp) ? sp : path.join(process.cwd(), sp);
    let store: CostStore;
    try {
      const raw = fs.readFileSync(full, "utf8");
      store = JSON.parse(raw) as CostStore;
      if (!Array.isArray(store.entries)) store.entries = [];
    } catch {
      store = { version: "1.0.0", entries: [] };
    }
    store.entries.push(entry);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const tmp = full + ".tmp." + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, full);
  } catch {
    // recordUsage never throws
  }
}

export function usageTotals(): { prompt_tokens: number; completion_tokens: number; entries: number } {
  try {
    if (isBrowser()) return { prompt_tokens: 0, completion_tokens: 0, entries: 0 };
    const fs = eval("require")("fs") as typeof import("fs");
    const path = eval("require")("path") as typeof import("path");
    const sp = storePath();
    const full = path.isAbsolute(sp) ? sp : path.join(process.cwd(), sp);
    const raw = fs.readFileSync(full, "utf8");
    const store = JSON.parse(raw) as CostStore;
    let pt = 0;
    let ct = 0;
    for (const e of store.entries ?? []) {
      pt += Number(e.prompt_tokens) || 0;
      ct += Number(e.completion_tokens) || 0;
    }
    return { prompt_tokens: pt, completion_tokens: ct, entries: (store.entries ?? []).length };
  } catch {
    return { prompt_tokens: 0, completion_tokens: 0, entries: 0 };
  }
}

export function overBudget(): boolean {
  try {
    if (isBrowser()) return false;
    const fs = eval("require")("fs") as typeof import("fs");
    const path = eval("require")("path") as typeof import("path");
    const cfg = loadConfig();
    const full = path.isAbsolute(cfg.cost.budget_path) ? cfg.cost.budget_path : path.join(process.cwd(), cfg.cost.budget_path);
    const budgetRaw = fs.readFileSync(full, "utf8");
    const budget = JSON.parse(budgetRaw) as { cap_tokens?: number; cap_cost_usd?: number; max_entries?: number };
    const totals = usageTotals();
    const totalTokens = totals.prompt_tokens + totals.completion_tokens;
    if (budget.cap_tokens !== undefined && totalTokens > budget.cap_tokens) return true;
    if (budget.max_entries !== undefined && totals.entries > budget.max_entries) return true;
    return false;
  } catch {
    return false;
  }
}
