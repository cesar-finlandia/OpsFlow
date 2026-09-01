// scripts/verify-headers.mjs — lightweight header-only check for gate step 6
const url = (process.argv[2] || process.env.OPSFLOW_URL || "").replace(/\/$/, "");
if (!url || !/^https?:\/\//.test(url)) {
  console.error(`✗ headers — OPSFLOW_URL not set and no URL arg — usage: node scripts/verify-headers.mjs https://<url>`);
  process.exit(1);
}
try {
  const res = await fetch(url, { method: "HEAD" });
  const oac = res.headers.get("origin-agent-cluster");
  const pp = res.headers.get("permissions-policy");
  if (oac !== "?1") {
    console.error(`✗ headers — Origin-Agent-Cluster expected "?1", got ${JSON.stringify(oac)} at ${url}`);
    process.exit(1);
  }
  if (!pp || !pp.toLowerCase().includes("tools=(self)")) {
    console.error(`✗ headers — Permissions-Policy expected "tools=(self)", got ${JSON.stringify(pp)} at ${url}`);
    process.exit(1);
  }
  console.log(`✓ headers — Origin-Agent-Cluster: ${oac}, Permissions-Policy: ${pp} at ${url}`);
} catch (e) {
  console.error(`✗ headers — fetch failed: ${String(e?.message ?? e).slice(0,600)} at ${url}`);
  process.exit(1);
}
