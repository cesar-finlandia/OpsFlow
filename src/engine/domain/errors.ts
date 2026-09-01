import type { ToolError, ToolErrorCode } from "../types.ts";

export function makeToolError(code: ToolErrorCode, message: string, details?: Record<string, unknown>): { ok: false; error: ToolError } {
  const truncated = message.length > 500 ? message.slice(0, 500) : message;
  const error: ToolError = { code, message: truncated };
  if (details !== undefined) error.details = details;
  return { ok: false, error };
}

export function ok<T>(data: T, degraded?: boolean): { ok: true; data: T; degraded?: boolean } {
  if (degraded) return { ok: true, data, degraded: true };
  return { ok: true, data };
}
