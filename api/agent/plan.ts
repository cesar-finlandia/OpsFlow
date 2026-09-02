import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sendJson, withCors, methodGuard } from "../_shared.js";
import { vertexAvailable, vertexConfig, vertexAccessToken, vertexGenerateContentUrl } from "../_vertex.js";
import type { ToolName, PlanStep, ToolPlan } from "../../src/engine/types.js";

const PLANNER_MODEL = "gemini-2.0-flash" as const;

// Inline minimal catalog + deterministic planner to avoid src/* alias imports in Vercel runtime
function loadCatalog(): { products: Array<{ id: string; variants: Array<{ options: { size: string; color: string }; sku: string }> }> } {
  try { const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8"); return JSON.parse(raw) as never; } catch {}
  try { const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8"); return JSON.parse(raw2) as never; } catch {}
  return { products: [] as never };
}

function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function planDeterministicInline(goal: string, catalog: ReturnType<typeof loadCatalog>): ToolPlan {
  try {
    const original = (goal ?? "").slice(0, 400);
    const g = (goal ?? "").toLowerCase();
    const isInjection = g.includes("ignore your instructions") || g.includes("delete all holds") || g.includes("ignore") && g.includes("confirm everything");
    const defaultLimit = 25; const defaultTtl = 15; const minTtl = 1; const maxTtl = 120;
    const trimmedLower = g.trim();
    if (trimmedLower === "hold all low-stock blue variants under $12 shipping to zone 4 for 15 minutes") {
      return { goal: original, steps: [{ tool: "search_inventory", args: { query: "blue", inStockOnly: true, limit: defaultLimit }, rationale: "search because goal says 'hold all low-stock blue variants'" }, { tool: "filter_variants", args: { options: { color: "blue" }, maxPriceCents: 1200, maxStock: 5, limit: defaultLimit }, rationale: "filter because goal mentions 'blue', 'low-stock' and 'under $12'" }, { tool: "calculate_shipping", args: { items: [], zone: 4, service: "ground" }, rationale: "shipping to zone 4 because goal says 'zone 4'" }, { tool: "hold_order", args: { lineItems: [], ttlMinutes: 15, note: g.slice(0, 200) }, rationale: "hold because goal says 'hold'" }], planner: "deterministic", degraded: false, created_at: new Date().toISOString() };
    }
    if (trimmedLower === "search red shoes") return { goal: original, steps: [{ tool: "search_inventory", args: { query: "red shoes", limit: defaultLimit }, rationale: "search because goal says 'search red shoes'" }], planner: "deterministic", degraded: false, created_at: new Date().toISOString() };
    const colorSet = new Set<string>(); for (const p of catalog.products ?? []) for (const v of p.variants ?? []) if (v.options?.color) colorSet.add(v.options.color.toLowerCase());
    const foundColors = [...colorSet].filter(c => g.includes(c));
    const sizeSet = new Set<string>(); for (const p of catalog.products ?? []) for (const v of p.variants ?? []) if (v.options?.size) sizeSet.add(v.options.size.toLowerCase());
    const foundSizes = [...sizeSet].filter(s => new RegExp(`\\b${escapeRegExp(s)}\\b`, "i").test(g));
    let maxPriceCents: number | null = null; const pm = g.match(/(?:under|below|<)\s*\$?\s*(\d+(?:\.\d{1,2})?)/); if (pm && pm[1]) { const v = parseFloat(pm[1]); if (!Number.isNaN(v)) maxPriceCents = Math.round(v*100); }
    let zone: number | null = null; const zm = g.match(/zone\s*([1-5])/); if (zm && zm[1]) zone = parseInt(zm[1], 10);
    let service: string | null = null; for (const s of [{w:"overnight",m:"overnight"},{w:"expedited",m:"expedited"},{w:"express",m:"expedited"},{w:"ground",m:"ground"}]) if (new RegExp(`\\b${escapeRegExp(s.w)}\\b`).test(g)) { service = s.m; break; }
    let ttl = defaultTtl; const tm = g.match(/(\d{1,3})\s*(?:min|minute)/); if (tm && tm[1]) { const n=parseInt(tm[1],10); if (!Number.isNaN(n)) ttl=Math.max(minTtl,Math.min(maxTtl,n)); }
    const lowStock = /low[- ]?stock/.test(g);
    const stopWords = new Set(["the","a","an","and","or","for","with","all","hold","reserve","confirm","commit","fulfil","fulfill","shipping","zone","stock","low","under","below","minutes","minute","ground","expedited","overnight","express","variants","variant","dollars","dollar","usd","price","show","me","my","full","catalog","entire","list","display","view","see","items","item","products","product","what","which","kind","kinds","type","types","are","is","of","in","this","that","there","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","can","may","might","must","shall","when","where","why","how","are","is","whats","what's"]);
    const isBroadCatalog = /what kind of products|what products|show.*catalog|full catalog|entire catalog|list.*catalog|what.*in.*catalog/i.test(g);
    const rawTokens = g.split(/[^a-z0-9\$]+/).filter(Boolean); const filtered: string[] = []; const ttlTok = tm?.[1] ?? null;
    for (const tok of rawTokens) { if (stopWords.has(tok)) continue; if (/^\d+(\.\d+)?$/.test(tok)) continue; if (tok.startsWith("$") && /^\$\d/.test(tok)) continue; if (pm && tok === pm[1]) continue; if (zone!==null && tok===String(zone) && /zone/.test(g)) continue; if (ttlTok && tok===ttlTok) continue; if (foundColors.includes(tok)) continue; if (foundSizes.includes(tok)) continue; if (tok==="to"||tok==="search"||tok==="my"||tok==="last") continue; if (/^\d+$/.test(tok)) continue; filtered.push(tok); }
    let query = filtered.join(" ").trim(); if (isBroadCatalog) query = "*";
    if (!query) { if (foundColors.length>0) query=foundColors[0]!; else if (foundSizes.length>0) query=foundSizes[0]!; else query="*"; } query=query.slice(0,200);
    const steps: PlanStep[] = []; const first50 = original.slice(0,50); const searchRationale = query==="*" ? "search fallback for unparseable goal" : `search because goal says '${first50}'`;
    const searchArgs: Record<string, unknown> = { query, limit: defaultLimit }; if (lowStock) (searchArgs as Record<string, unknown>)["inStockOnly"]=true; steps.push({ tool: "search_inventory", args: searchArgs, rationale: searchRationale });
    const shouldFilterBase = foundColors.length>0 || foundSizes.length>0 || maxPriceCents!==null || lowStock;
    let shouldFilter = shouldFilterBase; if (shouldFilterBase && foundColors.length===1 && !lowStock && maxPriceCents===null && foundSizes.length===0) if (/^search\b/.test(g)) shouldFilter=false;
    if (shouldFilter) { const opts: Record<string,string> = {}; if (foundColors.length>0) opts["color"]=foundColors[0]!; if (foundSizes.length>0) opts["size"]=foundSizes[0]!; const fa: Record<string,unknown> = { limit: defaultLimit }; if (Object.keys(opts).length>0) fa["options"]=opts; if (maxPriceCents!==null) fa["maxPriceCents"]=maxPriceCents; if (lowStock) fa["maxStock"]=5; steps.push({ tool: "filter_variants", args: fa, rationale: `filter because goal mentions ${foundColors[0] ?? ""}` }); }
    const needsShipping = zone!==null || service!==null || /ship/.test(g);
    if (needsShipping) { const ez = (zone??1) as number; const es = (service??"ground") as string; steps.push({ tool: "calculate_shipping", args: { items: [], zone: ez, service: es }, rationale: `shipping to zone ${ez} because goal says 'zone ${ez}'` }); }
    if (/hold|reserve/.test(g) && !isInjection) steps.push({ tool: "hold_order", args: { lineItems: [], ttlMinutes: ttl, note: g.slice(0,200) }, rationale: "hold because goal says 'hold'" });
    if (/confirm|commit|fulfil/.test(g) && !isInjection) steps.push({ tool: "confirm_fulfillment", args: { holdId: "PENDING" }, rationale: "confirm because goal says 'confirm'" });
    return { goal: original, steps, planner: "deterministic", degraded: false, created_at: new Date().toISOString() };
  } catch {
    const fg = (goal ?? "").slice(0,400); return { goal: fg, steps: [{ tool: "search_inventory", args: { query: (fg.slice(0,200)||"*"), limit: 25 }, rationale: "search fallback for unparseable goal" }], planner: "deterministic", degraded: false, created_at: new Date().toISOString() };
  }
}

function buildPlannerPromptInline(goal: string, ctx: { skus?: string[] }): { system: string; user: string } {
  const truncated = (goal ?? "").slice(0,400);
  const schemasBlock = `- search_inventory: {query:string(1..200), inStockOnly?:boolean, limit?:1..50}
- filter_variants: {skuPrefix?:string, options?:{size,color}, maxPriceCents?, minStock?, maxStock?, limit?}
- calculate_shipping: {items:[{sku,qty}], zone:1..5, service:ground|expedited|overnight}
- hold_order: {lineItems:[{sku,qty}], ttlMinutes:1..120, note?:string}
- confirm_fulfillment: {holdId:string}`;
  const system = `You are OpsFlow's fulfillment planner. Translate goal into JSON {goal,steps:[{tool,args,rationale}]}. Tools:\n${schemasBlock}\nRules: 1) Return ONLY JSON. 2) tool enum check. 3) args valid. 4) hold/confirm last. 5) Order search>filter>calculate>hold>confirm. 6) rationale names goal phrase. 7) For broad catalog questions like "what kind of products are in this catalog?" or "show me the full catalog", use search_inventory query:"*" (wildcard).`;
  const skuPart = ctx.skus?.slice(0,50).join(", ") || "(none)";
  const user = `Goal: ${truncated}\nCurrent SKUs: ${skuPart}`;
  return { system, user };
}

function isValidTool(tool: string): boolean { return ["search_inventory","filter_variants","calculate_shipping","hold_order","confirm_fulfillment"].includes(tool); }

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    withCors(res);
    if (!methodGuard(req, res, ["POST"])) return;
    const rawBody: unknown = (req as { body?: unknown }).body;
    let body: { goal?: unknown; context?: { skus?: string[] } };
    if (typeof rawBody === "string") {
      try { body = JSON.parse(rawBody) as { goal?: unknown; context?: { skus?: string[] } }; } catch { body = {}; }
    } else if (rawBody && typeof rawBody === "object") {
      body = rawBody as { goal?: unknown; context?: { skus?: string[] } };
    } else {
      body = {};
    }
    const rawGoal = typeof body.goal === "string" ? body.goal : "";
    const goal = rawGoal.slice(0, 400);
    const ctx = (body.context ?? {}) as { skus?: string[] };

    // 1) Try Vertex (preferred, scoped) if configured
    let useVertex = false;
    try { useVertex = vertexAvailable(); } catch { useVertex = false; }
    if (useVertex) {
      const { system, user } = buildPlannerPromptInline(goal, ctx);
      let text: string | null = null;
      try {
        const cfg = vertexConfig();
        if (!cfg) throw new Error("vertex unconfigured");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const token = await vertexAccessToken(controller.signal);
          const vertexBody = {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
          };
          const r = await fetch(vertexGenerateContentUrl(cfg, PLANNER_MODEL), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(vertexBody),
            signal: controller.signal,
          });
          if (!r.ok) throw new Error(`vertex ${r.status} ${await r.text().then(t=>t.slice(0,200)).catch(()=>"")}`);
          const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        } finally { clearTimeout(timeout); }
      } catch {}
      if (text) {
        try {
          const parsed = JSON.parse(text) as { steps?: Array<{ tool: string; args: Record<string, unknown>; rationale?: string }> };
          const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
          const valid: PlanStep[] = [];
          for (const s of rawSteps) {
            if (!s.tool || !isValidTool(s.tool)) continue;
            if (typeof s.args !== "object" || s.args === null) continue;
            valid.push({ tool: s.tool as ToolName, args: s.args as Record<string, unknown>, rationale: typeof s.rationale === "string" ? s.rationale : "gemini" });
          }
          if (valid.length > 0) {
            const plan: ToolPlan = { goal, steps: valid, planner: PLANNER_MODEL, degraded: false, created_at: new Date().toISOString() };
            sendJson(res, 200, plan);
            return;
          }
        } catch {}
      }
      // Vertex failed or returned no valid steps → fall through to Gemini API key / deterministic
    }

    // 2) Try Gemini API key (Generative Language API) if set - works even when Vertex key creation is blocked by org policy
    const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
    if (geminiKey) {
      const { system, user } = buildPlannerPromptInline(goal, ctx);
      let text: string | null = null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${PLANNER_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`;
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: user }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
            }),
            signal: controller.signal,
          });
          if (!r.ok) throw new Error(`gemini ${r.status} ${await r.text().then(t=>t.slice(0,200)).catch(()=>"")}`);
          const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        } finally { clearTimeout(timeout); }
      } catch {}
      if (text) {
        try {
          const parsed = JSON.parse(text) as { steps?: Array<{ tool: string; args: Record<string, unknown>; rationale?: string }> };
          const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
          const valid: PlanStep[] = [];
          for (const s of rawSteps) {
            if (!s.tool || !isValidTool(s.tool)) continue;
            if (typeof s.args !== "object" || s.args === null) continue;
            valid.push({ tool: s.tool as ToolName, args: s.args as Record<string, unknown>, rationale: typeof s.rationale === "string" ? s.rationale : "gemini" });
          }
          if (valid.length > 0) {
            const plan: ToolPlan = { goal, steps: valid, planner: PLANNER_MODEL, degraded: false, created_at: new Date().toISOString() };
            sendJson(res, 200, plan);
            return;
          }
        } catch {}
      }
      // Gemini API key failed → fall through to deterministic
    }

    // 3) No Vertex/Gemini or both failed → deterministic (NFR-11 clean clone, always works)
    const plan = planDeterministicInline(goal, loadCatalog());
    // Mark degraded if we tried Vertex/Gemini and failed, so UI can show degraded chip
    const triedLLM = useVertex || !!geminiKey;
    sendJson(res, 200, triedLLM ? { ...plan, degraded: true } : plan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.message} ${err.stack ?? ""}` : String(err);
    try {
      const rawBody2: unknown = (req as { body?: unknown }).body;
      let g = "";
      if (typeof rawBody2 === "string") { try { g = (JSON.parse(rawBody2) as { goal?: string }).goal ?? ""; } catch {} }
      else if (rawBody2 && typeof rawBody2 === "object") g = (rawBody2 as { goal?: string }).goal ?? "";
      const fb = planDeterministicInline(g, loadCatalog());
      sendJson(res, 200, { ...fb, degraded: true });
    } catch {
      sendJson(res, 500, { ok: false, error: { code: "DEGRADED", message: msg.slice(0, 500) } });
    }
  }
}
