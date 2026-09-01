import { emitToolEvent } from "src/engine/envelopes.ts";
import type { ToolName } from "src/engine/types.ts";

type Req = { tool: ToolName; args: Record<string, unknown>; summary: string };
let handler: ((req: Req) => Promise<boolean>) | null = null;
const g = globalThis as unknown as Record<string, unknown>;
function getHandler(): ((req: Req) => Promise<boolean>) | null {
  const gh = g["__opsflow_confirm_handler"] as ((req: Req) => Promise<boolean>) | null | undefined;
  return (gh !== undefined ? gh : handler) as ((req: Req) => Promise<boolean>) | null;
}

export function setConfirmationHandler(fn: (req: Req) => Promise<boolean>): void {
  handler = fn;
  g["__opsflow_confirm_handler"] = fn;
}

export async function requestConfirmation(req: Req): Promise<boolean> {
  await emitToolEvent("session.confirm", "started", { tool: req.tool, args: req.args });
  let granted: boolean;
  const h = getHandler();
  if (!h) granted = false;
  else {
    try {
      granted = await h(req);
    } catch {
      granted = false;
    }
  }
  await emitToolEvent("session.confirm", "done", { tool: req.tool, args: req.args, granted });
  return granted;
}
