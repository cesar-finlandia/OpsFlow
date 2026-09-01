// Requirement IDs: FR-07, FR-09, NFR-07 | DP-CORE (isomorphic validation seam)
//
// Why this file exists.
// -------------------------------------------------------------------------
// The chassis validator (`validate` from src/resilience) wraps ajv and resolves
// ajv through `createRequire(import.meta.url)`, which only works inside a real
// Node runtime. The five WebMCP tools run *in the browser* — that is the whole
// point of the entry (MAN-01) — so every call to the chassis validator from a
// browser bundle throws "ajv validation requires a Node runtime". Call sites
// that swallowed that throw silently degraded to "no validation at all", which
// breaks FR-07 ("every tool validates its input against its own inputSchema
// before executing and returns a typed ToolError") exactly where it is judged.
//
// The chassis is composed, never edited (NFR-05), so the entry owns this small
// isomorphic checker instead. It covers precisely the JSON Schema draft-07
// keyword set used by `src/webmcp/schemas.ts` and by the event envelope
// contract — no more — and it returns the chassis `ValidationResult` shape so
// call sites are interchangeable. Server routes use it too, so the browser and
// the serverless function reject exactly the same inputs.
//
// Deliberately NOT supported (absent from every schema in this repo): $ref,
// allOf/anyOf/oneOf/not, if/then/else, patternProperties, dependencies,
// propertyNames, contains, uniqueItems, format, const, multipleOf.

export interface SchemaCheckError {
  /** JSON Pointer-style location of the failing field ("/" = document root). */
  path: string;
  /** Human-readable failure description. */
  message: string;
  /** Stable machine-readable code — the failing JSON Schema keyword. */
  code: string;
}

export interface SchemaCheckResult {
  valid: boolean;
  errors: SchemaCheckError[];
}

type Json = unknown;
type Schema = Record<string, Json>;

const MAX_ERRORS = 20;

function pointer(path: string[]): string {
  return path.length === 0 ? "/" : "/" + path.join("/");
}

function typeOf(value: Json): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: Json, type: string): boolean {
  switch (type) {
    case "object":
      return typeOf(value) === "object";
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    default:
      return true; // unknown type keyword — not our business to enforce
  }
}

function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (typeOf(a) === "object") {
    const ao = a as Record<string, Json>;
    const bo = b as Record<string, Json>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
  }
  return false;
}

function check(value: Json, schema: Json, path: string[], errors: SchemaCheckError[]): void {
  if (errors.length >= MAX_ERRORS) return;
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    errors.push({ path: pointer(path), message: "value is not allowed here", code: "false schema" });
    return;
  }
  if (typeOf(schema) !== "object") return;
  const s = schema as Schema;

  // ---- type ----
  const t = s["type"];
  if (typeof t === "string" && !matchesType(value, t)) {
    errors.push({ path: pointer(path), message: `must be ${t}`, code: "type" });
    return; // further keywords assume the type holds
  }
  if (Array.isArray(t) && !t.some((one) => typeof one === "string" && matchesType(value, one))) {
    errors.push({ path: pointer(path), message: `must be one of ${t.join(", ")}`, code: "type" });
    return;
  }

  // ---- enum ----
  const en = s["enum"];
  if (Array.isArray(en) && !en.some((candidate) => deepEqual(value, candidate))) {
    errors.push({
      path: pointer(path),
      message: `must be equal to one of the allowed values: ${en.map((v) => JSON.stringify(v)).join(", ")}`,
      code: "enum",
    });
  }

  // ---- string ----
  if (typeof value === "string") {
    const minLength = s["minLength"];
    if (typeof minLength === "number" && value.length < minLength) {
      errors.push({ path: pointer(path), message: `must NOT have fewer than ${minLength} characters`, code: "minLength" });
    }
    const maxLength = s["maxLength"];
    if (typeof maxLength === "number" && value.length > maxLength) {
      errors.push({ path: pointer(path), message: `must NOT have more than ${maxLength} characters`, code: "maxLength" });
    }
    const pattern = s["pattern"];
    if (typeof pattern === "string") {
      let re: RegExp | null = null;
      try {
        re = new RegExp(pattern);
      } catch {
        re = null; // an unusable pattern must not fail the input
      }
      if (re && !re.test(value)) {
        errors.push({ path: pointer(path), message: `must match pattern "${pattern}"`, code: "pattern" });
      }
    }
  }

  // ---- number / integer ----
  if (typeof value === "number") {
    const minimum = s["minimum"];
    if (typeof minimum === "number" && value < minimum) {
      errors.push({ path: pointer(path), message: `must be >= ${minimum}`, code: "minimum" });
    }
    const maximum = s["maximum"];
    if (typeof maximum === "number" && value > maximum) {
      errors.push({ path: pointer(path), message: `must be <= ${maximum}`, code: "maximum" });
    }
  }

  // ---- array ----
  if (Array.isArray(value)) {
    const minItems = s["minItems"];
    if (typeof minItems === "number" && value.length < minItems) {
      errors.push({ path: pointer(path), message: `must NOT have fewer than ${minItems} items`, code: "minItems" });
    }
    const maxItems = s["maxItems"];
    if (typeof maxItems === "number" && value.length > maxItems) {
      errors.push({ path: pointer(path), message: `must NOT have more than ${maxItems} items`, code: "maxItems" });
    }
    const itemSchema = s["items"];
    if (itemSchema !== undefined && !Array.isArray(itemSchema)) {
      for (let i = 0; i < value.length; i += 1) {
        check(value[i], itemSchema, [...path, String(i)], errors);
        if (errors.length >= MAX_ERRORS) return;
      }
    }
  }

  // ---- object ----
  if (typeOf(value) === "object") {
    const obj = value as Record<string, Json>;
    const props = (typeOf(s["properties"]) === "object" ? (s["properties"] as Record<string, Json>) : {}) as Record<string, Json>;

    const required = s["required"];
    if (Array.isArray(required)) {
      for (const key of required) {
        if (typeof key === "string" && !Object.prototype.hasOwnProperty.call(obj, key)) {
          errors.push({ path: pointer(path), message: `must have required property '${key}'`, code: "required" });
        }
      }
    }

    const additional = s["additionalProperties"];
    if (additional === false) {
      for (const key of Object.keys(obj)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          errors.push({ path: pointer(path), message: `must NOT have additional property '${key}'`, code: "additionalProperties" });
        }
      }
    }

    for (const [key, sub] of Object.entries(props)) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      check(obj[key], sub, [...path, key], errors);
      if (errors.length >= MAX_ERRORS) return;
    }
  }
}

/**
 * Validate `data` against `schema`. Never throws; runs identically in the
 * browser, in jsdom and in Node. Returns the chassis ValidationResult shape.
 */
export function checkSchema(schema: object, data: unknown): SchemaCheckResult {
  const errors: SchemaCheckError[] = [];
  try {
    check(data, schema as Json, [], errors);
  } catch (e: unknown) {
    // A malformed schema must surface as a validation failure, never as a throw
    // that a caller then swallows into "input is fine" (the bug this replaces).
    errors.push({ path: "/", message: `schema could not be evaluated: ${String((e as Error)?.message ?? e)}`, code: "schema" });
  }
  return { valid: errors.length === 0, errors };
}

/** Validation errors only — convenience for call sites that just branch on length. */
export function schemaErrors(schema: object, data: unknown): SchemaCheckError[] {
  return checkSchema(schema, data).errors;
}
