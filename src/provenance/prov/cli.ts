// Shim for DP-SHIP W4: package.json submit:disclosure references src/provenance/prov/cli.ts
// but the actual chassis disclosure generator lives at src/provenance/provo/cli.ts.
// This shim re-exports and delegates to provo so both paths work (never edits src/** logic).
import { runProvoCli } from "../provo/cli.js";

export { runProvoCli as runProvCli };

const argv1 = (process.argv[1] ?? "").replace(/\\/g, "/");
const invokedDirectly = argv1.endsWith("src/provenance/prov/cli.ts");
const invokedViaViteNode =
  argv1.includes("vite-node") &&
  process.env["CHASSIS_DISPATCH"] === undefined &&
  process.env["VITEST"] === undefined;
if (invokedDirectly || invokedViaViteNode) {
  process.exit(runProvoCli(process.argv.slice(2)));
}
