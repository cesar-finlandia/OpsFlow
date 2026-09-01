import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebMcpBanner } from "src/ui/components/WebMcpBanner.tsx";
import { DegradedBanner } from "src/ui/components/DegradedBanner.tsx";

describe("banners W2", () => {
  it("WebMcpBanner shows both enablement paths when !available", () => {
    render(<WebMcpBanner probe={{ available: false, reason: "no-model-context", originIsolated: false }} />);
    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText(/WebMCP not detected/)).not.toBeNull();
    expect(screen.getByText(/ChatGPT desktop app/)).not.toBeNull();
    expect(screen.getByText(/chrome:\/\/flags\/#enable-webmcp-testing/)).not.toBeNull();
  });
  it("WebMcpBanner hides when available", () => {
    const { container } = render(<WebMcpBanner probe={{ available: true, reason: "ok", originIsolated: true }} />);
    expect(container.innerHTML).not.toContain("WebMCP not detected");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("DegradedBanner shows Replaying cached results when degraded", () => {
    render(<DegradedBanner degraded={true} />);
    expect(screen.getByRole("status")).not.toBeNull();
    expect(screen.getByText(/Replaying cached results/)).not.toBeNull();
  });
  it("DegradedBanner hides when not degraded", () => {
    const { container } = render(<DegradedBanner degraded={false} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
