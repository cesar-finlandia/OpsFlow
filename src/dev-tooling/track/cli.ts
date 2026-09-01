#!/usr/bin/env node
// DP-DEV W5 track — staleness gate via config/track.json mtime comparison
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

type ChainEntry = { artifact: string; source: string | null; produced_by: string };
type Row = { artifact: string; source: string | null; status: "fresh" | "stale" | "missing"; last_generated: string | null; produced_by: string };

function parseArgs() {
  const a = process.argv.slice(2);
  let json = false;
  let subcommand: string | null = null;
  for (const v of a) {
    if (v === "--json") json = true;
    else if (v === "status") subcommand = "status";
    else if (!v.startsWith("-") && !subcommand) subcommand = v;
  }
  return { json, subcommand };
}

function main() {
  const { json } = parseArgs();
  const configPath = resolve("config/track.json");
  let config: { version: string; chain: ChainEntry[] };
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.error(`track: cannot read ${configPath}: ${String(e)}`);
    process.exit(1);
  }

  const rows: Row[] = [];
  for (const entry of config.chain) {
    const artifactPath = resolve(entry.artifact);
    const sourcePath = entry.source ? resolve(entry.source) : null;

    let artifactStat: ReturnType<typeof statSync> | null = null;
    let exists = existsSync(artifactPath);
    // For deck/ directory, existsSync handles it; if exists, get stat
    if (exists) {
      try { artifactStat = statSync(artifactPath); } catch { exists = false; }
    }

    let status: Row["status"];
    let last_generated: string | null = null;

    if (!exists || !artifactStat) {
      status = "missing";
    } else {
      last_generated = artifactStat.mtime.toISOString();
      if (entry.source === null) {
        status = "fresh";
      } else {
        // Check source mtime
        let sourceStat: ReturnType<typeof statSync> | null = null;
        let sourceExists = sourcePath ? existsSync(sourcePath) : false;
        if (sourceExists && sourcePath) {
          try { sourceStat = statSync(sourcePath); } catch { sourceExists = false; }
        }
        if (!sourceExists || !sourceStat) {
          // If source missing, treat artifact as fresh (root handles null), but spec says stale only when source newer
          status = "fresh";
        } else {
          // stale when source mtime newer than artifact mtime (allow 1ms tolerance)
          if (sourceStat.mtimeMs > artifactStat.mtimeMs + 1) status = "stale";
          else status = "fresh";
        }
      }
    }

    rows.push({
      artifact: entry.artifact,
      source: entry.source,
      status,
      last_generated,
      produced_by: entry.produced_by,
    });
  }

  const allFresh = rows.every(r => r.status === "fresh");
  const ok = allFresh;

  // Render table
  const header = `${"artifact".padEnd(24)} | ${"source".padEnd(24)} | ${"status".padEnd(7)} | ${"last_generated".padEnd(24)} | produced_by`;
  const sep = "-".repeat(24) + "-+-" + "-".repeat(24) + "-+-" + "-".repeat(7) + "-+-" + "-".repeat(24) + "-+-" + "-".repeat(30);
  const lines: string[] = [];
  lines.push(header);
  lines.push(sep);
  for (const r of rows) {
    const lg = r.last_generated ?? "—";
    lines.push(`${r.artifact.padEnd(24)} | ${(r.source ?? "null").padEnd(24)} | ${r.status.padEnd(7)} | ${lg.padEnd(24)} | ${r.produced_by}`);
  }
  const table = lines.join("\n");

  if (json) {
    // When --json, output JSON and also table for human verification (verify expects table)
    console.log(JSON.stringify({ ok, rows }, null, 2));
    console.log("");
    console.log(table);
  } else {
    console.log(table);
    console.log(`\ntrack ${ok ? "ok" : "stale"}: ${rows.length} artifacts, ${rows.filter(r=>r.status!=="fresh").length} stale/missing`);
  }

  process.exit(ok ? 0 : 1);
}

main();
