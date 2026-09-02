import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sendJson, withCors, methodGuard } from "../_shared.js";
import { vertexAvailable, vertexConfig, vertexAccessToken, vertexGenerateContentUrl } from "../_vertex.js";

const ANSWER_MODEL = "gemini-3.5-flash-lite" as const;
const ANSWER_FALLBACK = "gemini-3.6-flash" as const;

function loadCatalog(): { products: Array<{ id: string; title: string; brand: string; category: string; variants: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number; stock: number }> }> } {
  try { const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8"); return JSON.parse(raw) as never; } catch {}
  try { const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8"); return JSON.parse(raw2) as never; } catch {}
  return { products: [] as never };
}

function buildAnswerPrompt(goal: string, matches: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number }>): { system: string; user: string } {
  const catalog = loadCatalog();
  const total = catalog.products.reduce((n,p)=>n+p.variants.length,0);
  // Date question: answer directly without catalog hallucination
  if (/what day|today|current date|date today/i.test(goal)) {
    const now = new Date();
    const formatted = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const system = `You are OpsFlow's helpful assistant, powered by ${ANSWER_MODEL}. Answer the user's date question accurately. Today is ${formatted}. Respond concisely (1-2 sentences).`;
    const user = `Goal: "${goal}"\n\nToday is ${formatted}. Answer what day is today.`;
    return { system, user };
  }
  // Low-stock informational: summarize count and sample
  if (/low[- ]?stock/i.test(goal)) {
    const allCategories = [...new Set(catalog.products.map(p => p.category))].join(", ");
    const sample = matches.slice(0, 10).map(m => `${m.sku}: ${m.title} (${m.options.color}/${m.options.size}) stock ${m.price_cents ? "" : ""}`).join("\n");
    // count low-stock from matches (search already filtered)
    const count = matches.length;
    const system = `You are OpsFlow's catalog assistant, powered by ${ANSWER_MODEL}. The user asked about low-stock items. You have searched the catalog and found ${count} low-stock variants (stock <= threshold). Summarize concisely (2-3 sentences): state how many low-stock items, mention a few examples, and note categories (${allCategories}). Do not invent SKUs beyond the sample.`;
    const user = `Goal: "${goal}"\n\nLow-stock result: ${count} variants (showing ${Math.min(count,10)}):\n${sample || "(no matches)"}\nTotal catalog: ${total} variants.\n\nProvide a concise answer: how many items are low stock and examples.`;
    return { system, user };
  }
  const allCategories = [...new Set(catalog.products.map(p => p.category))].join(", ");
  const allBrands = [...new Set(catalog.products.map(p => p.brand))].join(", ");
  const sample = matches.slice(0, 20).map(m => `${m.sku}: ${m.title} (${m.options.color}/${m.options.size}) $${(m.price_cents/100).toFixed(2)}`).join("\n");
  const system = `You are OpsFlow's catalog assistant, powered by ${ANSWER_MODEL}. The user asked an informational question about the catalog. You have just searched the catalog and have these results. Summarize in a concise, helpful way (2-4 sentences). Mention categories (${allCategories}), brands (${allBrands}), variant diversity, and price range when relevant. Do not invent SKUs. Base your answer only on the provided sample.`;
  const user = `Goal: "${goal}"\n\nSearch result sample (${matches.length} shown of ${total} total):\n${sample || "(no matches)"}\n\nProvide a concise answer about the catalog for the user's goal.`;
  return { system, user };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    withCors(res);
    if (!methodGuard(req, res, ["POST"])) return;
    const rawBody: unknown = (req as { body?: unknown }).body;
    let body: { goal?: unknown; matches?: unknown };
    if (typeof rawBody === "string") {
      try { body = JSON.parse(rawBody) as { goal?: unknown; matches?: unknown }; } catch { body = {}; }
    } else if (rawBody && typeof rawBody === "object") {
      body = rawBody as { goal?: unknown; matches?: unknown };
    } else {
      body = {};
    }
    const goal = typeof body.goal === "string" ? body.goal.slice(0, 400) : "";
    const matches = Array.isArray(body.matches) ? body.matches as Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number }> : [];

    // Try Vertex first, then Gemini API key, then fallback to deterministic template
    const { system, user } = buildAnswerPrompt(goal, matches);

    // Vertex
    let useVertex = false;
    try { useVertex = vertexAvailable(); } catch { useVertex = false; }
    if (useVertex) {
      try {
        const cfg = vertexConfig();
        if (cfg) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const token = await vertexAccessToken(controller.signal);
            const r = await fetch(vertexGenerateContentUrl(cfg, ANSWER_MODEL), {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts: [{ text: user }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
              }),
              signal: controller.signal,
            });
            if (r.ok) {
              const j = await r.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
              const text = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) { sendJson(res, 200, { ok: true, answer: text, planner: ANSWER_MODEL }); return; }
            }
          } finally { clearTimeout(timeout); }
        }
      } catch {}
    }

    // Gemini API key
    const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
    if (geminiKey) {
      for (const model of [ANSWER_MODEL, ANSWER_FALLBACK] as const) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
            const r = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts: [{ text: user }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
              }),
              signal: controller.signal,
            });
            if (r.ok) {
              const j = await r.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
              const text = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) { sendJson(res, 200, { ok: true, answer: text, planner: model as unknown as string }); return; }
            }
          } finally { clearTimeout(timeout); }
        } catch {}
      }
    }

    // Deterministic fallback - template based on catalog / date
    if (/what day|today|current date|date today/i.test(goal)) {
      const now = new Date();
      const formatted = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      sendJson(res, 200, { ok: true, answer: `Today is ${formatted}.`, planner: "deterministic", degraded: true });
      return;
    }
    if (/low[- ]?stock/i.test(goal)) {
      const catalog = loadCatalog();
      const fallback = `Found ${matches.length} low-stock variants (stock at or below threshold) out of ${catalog.products.reduce((n,p)=>n+p.variants.length,0)} total. Sample: ${matches.slice(0,3).map(m=>`${m.title} (${m.options.color})`).join(", ")}${matches.length>3?"…":""}.`;
      sendJson(res, 200, { ok: true, answer: fallback, planner: "deterministic", degraded: true });
      return;
    }
    const catalog = loadCatalog();
    const total = catalog.products.reduce((n,p)=>n+p.variants.length,0);
    const categories = [...new Set(catalog.products.map(p=>p.category))].join(", ");
    const fallback = `The catalog contains ${total} variants across ${catalog.products.length} products (categories: ${categories}). Sample: ${matches.slice(0,3).map(m=>`${m.title} (${m.options.color})`).join(", ")}${matches.length>3?"…":""}. Prices range from $${Math.min(...matches.map(m=>m.price_cents))/100} to $${Math.max(...matches.map(m=>m.price_cents))/100} in this sample.`;
    sendJson(res, 200, { ok: true, answer: fallback, planner: "deterministic", degraded: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { ok: false, error: { code: "DEGRADED", message: msg.slice(0,500) } });
  }
}
