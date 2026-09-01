import * as React from "react";
import "src/ui/styles.css";
import { createRoot } from "react-dom/client";
import { setTheme } from "src/platform/ui";
import { setConfirmationHandler } from "src/webmcp/confirm.ts";
import { registerAllTools } from "src/webmcp/register.ts";
import { probeWebMcp } from "src/webmcp/policy.ts";
import { App } from "src/ui/App.tsx";
import { uiConfirm } from "src/ui/components/ConfirmDialog.tsx";

async function boot(): Promise<void> {
  setTheme("operator");
  (window as unknown as { __opsflowBootOrder?: string[] }).__opsflowBootOrder = ["theme"];
  setConfirmationHandler(uiConfirm);
  (window as unknown as { __opsflowBootOrder: string[] }).__opsflowBootOrder.push("confirm");
  await registerAllTools();
  (window as unknown as { __opsflowBootOrder: string[] }).__opsflowBootOrder.push("register");
  const probe = probeWebMcp();
  createRoot(document.getElementById("root")!).render(<React.StrictMode><App probe={probe} /></React.StrictMode>);
  (window as unknown as { __opsflowBootOrder: string[] }).__opsflowBootOrder.push("render");
}
boot();
