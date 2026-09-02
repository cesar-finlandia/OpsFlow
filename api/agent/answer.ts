import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sendJson, withCors, methodGuard } from "../_shared.js";
import { vertexAvailable, vertexConfig, vertexAccessToken, vertexGenerateContentUrl } from "../_vertex.js";

const ANSWER_MODEL = "gemini-2.5-flash" as const;

function loadCatalog(): { products: Array<{ id: string; title: string; brand: string; category: string; variants: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number; stock: number }> }> } {
  try { const raw = readFileSync(join(process.cwd(), "data/catalog.json"), "utf8"); return JSON.parse(raw) as never; } catch {}
  try { const raw2 = readFileSync(join(process.cwd(), "hackathon-entries/2026-09-webMCP/data/catalog.json"), "utf8"); return JSON.parse(raw2) as never; } catch {}
  return { products: [] as never };
}

function buildAnswerPrompt(goal: string, matches: Array<{ sku: string; title: string; options: { size: string; color: string }; price_cents: number }>): { system: string; user: string } {
  const catalog = loadCatalog();
  const allCategories = [...new Set(catalog.products.map(p => p.category))].join(", ");
  const allBrands = [...new Set(catalog.products.map(p => p.brand))].join(", ");
  const sample = matches.slice(0, 20).map(m => `${m.sku}: ${m.title} (${m.options.color}/${m.options.size}) $${(m.price_cents/100).toFixed(2)}`).join("\n");
  const system = `You are OpsFlow's catalog assistant, powered by gemini-2.5-flash. The user asked an informational question about the catalog. You have just searched the catalog and have these results. Summarize what kind of products are in the catalog in a concise, helpful way (2-4 sentences). Mention categories (${allCategories}), brands (${allBrands}), variant diversity, and price range. Do not invent SKUs. Base your answer only on the provided sample.`;
  const user = `Goal: "${goal}"\n\nSearch result sample (${matches.length} shown of ${catalog.products.reduce((n,p)=>n+p.variants.length,0)} total):\n${sample || "(no matches)"}\n\nProvide a concise answer about what kind of products are in this catalog.`;
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
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANSWER_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`;
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
            if (text) { sendJson(res, 200, { ok: true, answer: text, planner: ANSWER_MODEL }); return; }
          }
        } finally { clearTimeout(timeout); }
      } catch {}
    }

    // Deterministic fallback - template based on catalog
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
