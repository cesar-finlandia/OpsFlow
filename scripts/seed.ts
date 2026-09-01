// DP-SEED W1 — deterministic catalog generator (build-time only, never bundled)
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Chassis surfaces (build-time only)
import { generateRecords, watermarkBatch, WATERMARK_HEADER_TEXT } from "src/data";
import { setProviderCall } from "src/data/provider";
import { isDegradedResult } from "src/resilience";
import { vertexAvailable, vertexConfig, vertexAccessToken, vertexGenerateContentUrl } from "../api/_vertex.ts";

// Literal constants at top
const SEED = 20260901;
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 4294967296;

let s = SEED;
function next(): number { s = (LCG_A * s + LCG_C) % LCG_M; return s; }
function randInt(min: number, max: number): number { return min + (next() % (max - min + 1)); }
function randChoice<T>(arr: T[]): T { return arr[next() % arr.length]!; }
function roundTo50(n: number): number { return Math.round(n / 50) * 50; }

const CATEGORIES = ["Outerwear","Tops","Bottoms","Dresses","Knitwear","Activewear","Footwear","Accessories","Denim","Swimwear","Loungewear","Workwear"] as const;
const BRANDS = ["OpsFlow","NorthRange","Cedar & Thread","Field Study","Harbor Line"] as const;
const SIZES = ["XS","S","M","L","XL"] as const;
const COLORS = ["Blue","Black","Sand","Olive","Crimson"] as const;

const FALLBACK_TITLES: string[] = [
  "Cedar Waxed Canvas Jacket", "Harbor Lightweight Parka", "Field Study Chore Coat", "NorthRange Alpine Shell", "Crimson Trail Windbreaker",
  "Olive Everyday Oxford Shirt", "Sand Washed Tee", "Black Essential Crew Tee", "Blue Breton Stripe Top", "Crimson Mock-Neck Base Layer",
  "Sand Relaxed Chino", "Olive Cargo Pant", "Black Straight-Leg Jean", "Blue Wide-Leg Trouser", "Crimson Track Pant",
  "Sand Slip Dress", "Olive Shirtdress", "Black Wrap Dress", "Blue Poplin Dress", "Crimson Knit Midi Dress",
  "Sand Cable-Knit Sweater", "Olive Merino Pullover", "Black Cashmere Blend Cardigan", "Blue Waffle Knit Henley", "Crimson Half-Zip Fleece",
  "Sand Performance Legging", "Olive Training Short", "Black Studio Jogger", "Blue Lightweight Hoodie", "Crimson Sports Bra",
  "Sand Suede Chelsea Boot", "Olive Trail Sneaker", "Black Leather Loafer", "Blue Canvas Slip-On", "Crimson Running Shoe",
  "Sand Woven Tote Bag", "Olive Crossbody Sling", "Black Leather Belt", "Blue Embroidered Cap", "Crimson Wool Beanie",
  "Sand Slim Straight Jean", "Olive Selvedge Denim Jacket", "Black Coated Skinny Jean", "Blue Denim Overshirt", "Crimson Denim Utility Pant",
  "Sand One-Piece Swimsuit", "Olive Board Short", "Black Bikini Top", "Blue Rash Guard", "Crimson Swim Trunk",
  "Sand French Terry Sweatsuit", "Olive Lounge Pant", "Black Cozy Hoodie", "Blue Sleep Set", "Crimson Fleece Pullover",
  "Sand Utility Coverall", "Olive Work Jacket", "Black Ripstop Pant", "Blue Carpenter Jean", "Crimson Canvas Apron"
];

const TITLES: string[] = FALLBACK_TITLES;

async function maybeLLMNaming(): Promise<string[]> {
  let titles = [...FALLBACK_TITLES];
  // Optional LLM naming, through Vertex AI — the same access path the planner
  // uses (see api/_vertex.ts). Without credentials the generator quietly uses
  // the fallback titles, which is why data/catalog.json is reproducible from a
  // clean clone with no secrets.
  if (!vertexAvailable()) return titles;
  const cfg = vertexConfig();
  if (!cfg) return titles;
  try {
    setProviderCall(async (prompt: string, _modelProfile: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const token = await vertexAccessToken(controller.signal);
        const res = await fetch(vertexGenerateContentUrl(cfg, "gemini-2.5-flash"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
          signal: controller.signal,
        });
        const json: any = await res.json();
        return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } finally {
        clearTimeout(timer);
      }
    });
    const result: any = await generateRecords({
      domain: "apparel ops catalog",
      shape: { kind: "records", schema: { type: "object", properties: { id: { type: "string" }, title: { type: "string", maxLength: 80 }, brand: { type: "string" }, category: { type: "string" }, synthetic: { const: true } }, required: ["id","title","brand","category","synthetic"] } as any, count: 60 },
      watermark: true
    });
    if (!result || isDegradedResult(result) || !result.ok) {
      console.log("[seed] generateRecords degraded — using fallback titles");
      return titles;
    }
    const batch = (result as any).batch as any[];
    watermarkBatch(batch as unknown[], "records", WATERMARK_HEADER_TEXT);
    const llmTitles = batch.map((r: any) => String(r.title ?? "").slice(0,80));
    if (llmTitles.length === 60 && llmTitles.every((t: string) => t.length > 0 && t.length <= 80)) {
      for (let i = 0; i < 60; i++) if (typeof llmTitles[i] === "string") titles[i] = llmTitles[i]!;
    } else {
      console.log("[seed] generateRecords degraded — using fallback titles");
    }
  } catch (e) {
    console.log("[seed] generateRecords degraded — using fallback titles", String(e));
  }
  return titles;
}

async function main() {
  const effectiveTitles = await maybeLLMNaming();
  // Validate titles length
  for (const t of effectiveTitles) {
    if (t.length > 80) throw new Error(`title too long: ${t}`);
  }
  interface Variant {
    sku: string; product_id: string; title: string; options: { size: string; color: string };
    price_cents: number; stock: number; weight_g: number; low_stock_threshold: number; synthetic: true;
  }
  interface Product {
    id: string; title: string; brand: string; category: string; variants: Variant[]; synthetic: true;
  }
  const products: Product[] = [];
  for (let i = 0; i < 60; i++) {
    const productId = "OPS-" + String(1001 + i);
    const category = CATEGORIES[i % 12]!;
    const brand = randChoice([...BRANDS]);
    const title = effectiveTitles[i]!;
    const variantCount = i < 20 ? 4 : 3;
    const variants: Variant[] = [];
    const usedPairs = new Set<string>();
    for (let j = 0; j < variantCount; j++) {
      let size: string = randChoice([...SIZES]);
      let color: string = randChoice([...COLORS]);
      let attempts = 0;
      while (usedPairs.has(size + "|" + color) && attempts < 20) {
        size = randChoice([...SIZES]);
        color = randChoice([...COLORS]);
        attempts++;
      }
      if (usedPairs.has(size + "|" + color)) {
        // lexicographic fallback: find next unused pair
        outer: for (const s2 of [...SIZES].sort()) {
          for (const c2 of [...COLORS].sort()) {
            const key = s2 + "|" + c2;
            if (!usedPairs.has(key)) { size = s2; color = c2; break outer; }
          }
        }
      }
      usedPairs.add(size + "|" + color);
      const color3 = color.slice(0,3).toUpperCase();
      const sku = productId + "-" + color3 + "-" + size;
      if (!/^[A-Z0-9-]{6,32}$/.test(sku)) throw new Error(`SKU format invalid: ${sku}`);
      const price_cents = roundTo50(randInt(600, 4800));
      const r = next() % 100;
      let stock: number;
      if (r < 15) stock = 0;
      else if (r < 40) stock = randInt(1,5);
      else stock = randInt(6,80);
      const weight_g = randInt(120, 2400);
      const low_stock_threshold = 5;
      const variant: Variant = { sku, product_id: productId, title, options: { size, color }, price_cents, stock, weight_g, low_stock_threshold, synthetic: true };
      variants.push(variant);
    }
    variants.sort((a,b) => a.sku.localeCompare(b.sku));
    products.push({ id: productId, title, brand, category, variants, synthetic: true });
  }
  products.sort((a,b) => a.id.localeCompare(b.id));
  // Demo-goal guarantee assertion
  let allVariants: Variant[] = products.flatMap(p => p.variants);
  let matches = allVariants.filter(v => v.options.color === "Blue" && v.stock <= 5 && v.price_cents < 1200 && v.stock > 0);
  if (matches.length < 4) {
    const need = 4 - matches.length;
    const candidates = allVariants.filter(v => v.options.color === "Blue" && v.price_cents >= 1200).slice(0, need);
    for (const v of candidates) { v.price_cents = 1100; v.stock = 3; }
    console.log(`[seed] adjusted ${candidates.length} Blue variants down to price 1100 stock 3 (was <4 matches)`);
    allVariants = products.flatMap(p => p.variants);
    matches = allVariants.filter(v => v.options.color === "Blue" && v.stock <= 5 && v.price_cents < 1200 && v.stock > 0);
  } else if (matches.length > 12) {
    const excess = matches.length - 12;
    const cheapest = [...matches].sort((a,b) => a.price_cents - b.price_cents).slice(0, excess);
    for (const v of cheapest) { v.stock = 80; }
    console.log(`[seed] raised ${cheapest.length} Blue variants stock to 80 (was >12 matches)`);
    allVariants = products.flatMap(p => p.variants);
    matches = allVariants.filter(v => v.options.color === "Blue" && v.stock <= 5 && v.price_cents < 1200 && v.stock > 0);
  }
  if (!(matches.length >= 4 && matches.length <= 12)) throw new Error(`demo-goal guarantee failed: matches=${matches.length}`);
  const catalog = { version: "1.0.0", generated_at: new Date("2026-09-01T00:00:00.000Z").toISOString(), synthetic: true as const, products };
  // Ensure data dir
  mkdirSync("data", { recursive: true });
  writeFileSync("data/catalog.json", JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(WATERMARK_HEADER_TEXT);
  console.log(`[seed] wrote data/catalog.json with ${products.length} products, ${allVariants.length} variants, demo-goal matches=${matches.length}`);
  // Ensure cost-store empty seed if absent
  if (!existsSync("data/cost-store.json")) {
    writeFileSync("data/cost-store.json", JSON.stringify({ version: "1.0.0", entries: [] }, null, 2) + "\n", "utf8");
    console.log("[seed] seeded data/cost-store.json");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
