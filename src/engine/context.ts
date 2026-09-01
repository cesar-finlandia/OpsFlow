// DP-CORE W5 — transcript buffer (chassis context: fit, append, count)
import type { Message, Buffer } from "src/context";
import { loadConfig } from "./config";
// browser-safe fallback: real token counting is Node-only; UI uses simple in-memory buffer
const fitFn: ((b: Buffer, opts: unknown) => unknown) = (b) => b;
const appendFn: ((b: Buffer, m: Message) => unknown) = (b, m) => [...(b as unknown as Message[]), m] as unknown as Buffer;

let buffer: Buffer = [];

export function appendTranscript(role: "user" | "assistant" | "tool", text: string): void {
  const cfg = loadConfig();
  const msg: Message = { role, content: text } as Message;
  const appended = (appendFn as NonNullable<typeof appendFn>)(buffer, msg as unknown as Parameters<NonNullable<typeof appendFn>>[1]) as unknown;
  let next: Buffer;
  if (appended && typeof appended === "object" && "buffer" in (appended as Record<string, unknown>) && Array.isArray((appended as Record<string, unknown>)["buffer"])) {
    next = (appended as unknown as { buffer: Buffer }).buffer;
  } else if (Array.isArray(appended)) {
    next = appended as Buffer;
  } else {
    next = [...buffer, msg] as unknown as Buffer;
  }
  const fitted = (fitFn as NonNullable<typeof fitFn>)(next as unknown as Parameters<NonNullable<typeof fitFn>>[0], {
    max_tokens: cfg.context.max_tokens,
    // chassis expects context_window; include both for compat — spec requires max_tokens, chassis reads context_window
    context_window: cfg.context.max_tokens,
    reserve_output: cfg.context.reserve_output,
  } as unknown as Parameters<NonNullable<typeof fitFn>>[1]) as unknown;
  if (fitted && typeof fitted === "object" && "buffer" in (fitted as Record<string, unknown>)) {
    const maybe = (fitted as unknown as { buffer: Buffer }).buffer;
    if (Array.isArray(maybe)) {
      buffer = maybe;
      return;
    }
  }
  if (Array.isArray(fitted)) {
    buffer = fitted as Buffer;
  } else {
    buffer = next;
  }
}

export function transcript(): Message[] {
  return [...buffer];
}

export function resetTranscript(): void {
  buffer = [];
}
