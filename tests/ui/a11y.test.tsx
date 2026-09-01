import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "src/ui/components/ConfirmDialog.tsx";
import { HoldsScreen } from "src/ui/screens/HoldsScreen.tsx";
import { holdsStore } from "src/engine/domain/holdsStore.ts";

const req = {
  tool: "hold_order" as const,
  args: { lineItems: [{ sku: "OPS-001", qty: 1 }], ttlMinutes: 15 },
  summary: "Hold 1 SKU(s) for 15 minutes.",
};

describe("a11y W5", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("focus moves to Confirm button on open", async () => {
    const onResolve = vi.fn();
    render(<ConfirmDialog request={req} onResolve={onResolve} />);
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await waitFor(() => expect(document.activeElement).toBe(confirmBtn));
  });

  it("focus trap cycles within dialog", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConfirmDialog request={req} onResolve={onResolve} />);
    const dialog = screen.getByRole("dialog");
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await waitFor(() => expect(document.activeElement).toBe(confirmBtn));
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Escape resolves false", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConfirmDialog request={req} onResolve={onResolve} />);
    await user.keyboard("{Escape}");
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("backdrop click resolves false", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConfirmDialog request={req} onResolve={onResolve} />);
    await user.click(screen.getByTestId("confirm-backdrop"));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("holds expired row disables Confirm", async () => {
    const expiredHold = {
      hold_id: "HOLD-EXPIRED1",
      line_items: [{ sku: "OPS-001", qty: 1 }],
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
      ttl_minutes: 15,
      status: "held" as const,
      note: null,
      quote: null,
    };
    vi.spyOn(holdsStore, "list").mockReturnValue([expiredHold] as any);
    vi.spyOn(holdsStore, "subscribe").mockImplementation((fn: any) => {
      fn([expiredHold]);
      return () => {};
    });
    render(<HoldsScreen />);
    // Check expired row aria-label and text
    expect(screen.getByLabelText("expired")).toBeTruthy();
    expect(screen.getByText(/Expired — release to clear/)).toBeTruthy();
    const confirmBtn = screen.getByRole("button", { name: /confirm/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(confirmBtn.getAttribute("title")).toBe("Hold expired — cannot confirm");
    // TTL shows Expired
    expect(screen.getByText("Expired")).toBeTruthy();
  });
});
