// Requirement IDs: FR-12, NFR-01, NFR-06 | DP-SRV helper.
// Imported only by server-side and build-time code (api/agent/plan.ts and
// scripts/seed.ts). Never reachable from a browser bundle.
//
// Vertex AI access for the planner.
//
// The blueprint (§2.8, FR-12) fixes the model as Gemini 2.5 Flash called only
// from the server. It originally reached it through the Generative Language API
// with a `GEMINI_API_KEY`; this entry reaches the same model through **Vertex
// AI** instead, because a long-lived API key is the weakest available option:
// it cannot be scoped, cannot be rotated without redeploying, and is one
// copy-paste away from a public repository (the NFR-01 / R8 failure mode).
// Vertex authenticates with a short-lived OAuth access token minted from a
// service account, so nothing durable is ever in flight and the credential is
// scoped to one project.
//
// `PlannerKind` is unchanged — the model really is `gemini-2.5-flash`; only the
// endpoint and the credential differ.
//
// Configuration (all server-side environment variables, never bundled):
//   GOOGLE_VERTEX_PROJECT      required — GCP project id
//   GOOGLE_VERTEX_LOCATION     optional — region, default "us-central1"
//   GOOGLE_VERTEX_CREDENTIALS  optional — service-account JSON (raw or base64)
//
// When GOOGLE_VERTEX_CREDENTIALS is absent the helper tries the GCP metadata
// server (Application Default Credentials, for deploys that run on Google
// infrastructure). When neither is available it reports "unconfigured" and the
// route falls back to the deterministic planner — the keyless path that makes
// NFR-11 ("builds and runs from a clean clone with no .env") true.

import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export interface VertexConfig {
  project: string;
  location: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let cachedToken: { value: string; expiresAtMs: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Parse GOOGLE_VERTEX_CREDENTIALS, accepting raw JSON or base64-encoded JSON. */
function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_VERTEX_CREDENTIALS;
  if (!raw || raw.trim() === "") return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const parsed = JSON.parse(text) as ServiceAccount;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    // Vercel's env UI stores newlines escaped; restore them for the PEM parser.
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** Resolve project + location, or null when Vertex is not configured. */
export function vertexConfig(): VertexConfig | null {
  const sa = readServiceAccount();
  const project = process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? sa?.project_id;
  if (!project) return null;
  return { project, location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1" };
}

/** True when the route may attempt a Vertex call at all. */
export function vertexAvailable(): boolean {
  if (vertexConfig() === null) return false;
  return readServiceAccount() !== null || process.env.GOOGLE_VERTEX_USE_METADATA === "1";
}

async function mintFromServiceAccount(sa: ServiceAccount, signal: AbortSignal): Promise<{ token: string; ttlSeconds: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    signal,
  });
  if (!res.ok) throw new Error(`vertex token exchange ${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("vertex token exchange returned no access_token");
  return { token: json.access_token, ttlSeconds: json.expires_in ?? 3600 };
}

async function mintFromMetadata(signal: AbortSignal): Promise<{ token: string; ttlSeconds: number }> {
  const res = await fetch(METADATA_TOKEN_URL, { headers: { "Metadata-Flavor": "Google" }, signal });
  if (!res.ok) throw new Error(`vertex metadata token ${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("vertex metadata returned no access_token");
  return { token: json.access_token, ttlSeconds: json.expires_in ?? 3600 };
}

/**
 * A valid OAuth access token for Vertex AI. Cached in module memory until 60 s
 * before expiry, so a warm serverless instance mints at most one token per hour.
 * Throws on failure — callers run inside `guarded()` and degrade.
 */
export async function vertexAccessToken(signal: AbortSignal): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs) return cachedToken.value;
  const sa = readServiceAccount();
  const minted = sa ? await mintFromServiceAccount(sa, signal) : await mintFromMetadata(signal);
  cachedToken = { value: minted.token, expiresAtMs: Date.now() + Math.max(0, minted.ttlSeconds - 60) * 1000 };
  return cachedToken.value;
}

/** Full generateContent endpoint for a publisher model on Vertex AI. */
export function vertexGenerateContentUrl(cfg: VertexConfig, model: string): string {
  const host = cfg.location === "global" ? "aiplatform.googleapis.com" : `${cfg.location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${cfg.project}/locations/${cfg.location}/publishers/google/models/${model}:generateContent`;
}

/** Reset the cached token — tests only. */
export function resetVertexTokenCache(): void {
  cachedToken = null;
}
