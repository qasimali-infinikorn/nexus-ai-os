// Shared request-validation limits and helpers for the API routes.
// See docs/SECURITY.md for the review findings these guardrails address.

export const ALLOWED_PROVIDERS = ["openai", "anthropic", "google"] as const;
export type Provider = (typeof ALLOWED_PROVIDERS)[number];

export function isValidProvider(value: unknown): value is Provider {
  return typeof value === "string" && (ALLOWED_PROVIDERS as readonly string[]).includes(value);
}

export const MAX_PROMPT_LENGTH = 20_000;
export const MAX_CONTEXT_LENGTH = 100_000;
export const MAX_MODEL_LENGTH = 100;

export const MAX_KNOWLEDGE_NAME_LENGTH = 200;
export const MAX_KNOWLEDGE_CONTENT_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_KNOWLEDGE_QUERY_LENGTH = 500;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
