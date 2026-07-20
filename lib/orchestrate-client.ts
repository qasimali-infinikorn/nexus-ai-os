// Shared browser-side client for the /api/orchestrate NDJSON stream.
// Every feature tab talks to the orchestrator through this module instead of
// re-implementing the fetch + stream-decode loop.

export type Provider = "openai" | "anthropic" | "google";

export const PROVIDERS: Provider[] = ["openai", "anthropic", "google"];

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
}

/** Props shared by every feature tab that calls the orchestrator. */
export interface AgentPanelProps {
  provider: Provider;
  model: string;
  keys: ApiKeys;
}

export interface OrchestrateRequest {
  provider: Provider;
  model: string;
  prompt: string;
  agentType: string;
  keys: ApiKeys;
  context?: string;
}

export interface StreamCallbacks {
  onStatus?: (message: string) => void;
  /** Called with the latest full result whenever the server sends one. */
  onResult?: (content: string) => void;
}

interface StreamEvent {
  type?: string;
  message?: string;
  content?: string;
}

/**
 * Calls /api/orchestrate and consumes its NDJSON response stream.
 * Resolves with the final result content. Throws when the server reports an
 * error — including `{"type":"error"}` events sent mid-stream, which the old
 * per-component loops accidentally swallowed inside their JSON.parse catch.
 */
export async function streamOrchestrate(
  request: OrchestrateRequest,
  { onStatus, onResult }: StreamCallbacks = {}
): Promise<string> {
  const response = await fetch("/api/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    // Non-stream failures (validation, rate limiting) are plain JSON bodies.
    const message = await response
      .json()
      .then((data: StreamEvent) => data?.message)
      .catch(() => null);
    throw new Error(message || `The server returned status ${response.status}.`);
  }

  if (!response.body) {
    throw new Error("The server returned an empty response stream.");
  }

  let finalContent = "";

  const handleLine = (line: string) => {
    if (!line.trim()) return;

    let event: StreamEvent;
    try {
      event = JSON.parse(line);
    } catch {
      return; // Malformed line; skip it without masking real error events.
    }

    if (event.type === "error") {
      throw new Error(event.message || "Orchestration failed.");
    }
    if (event.type === "status" && event.message) {
      onStatus?.(event.message);
    }
    if (
      (event.type === "agent_result" || event.type === "final_result") &&
      typeof event.content === "string"
    ) {
      finalContent = event.content;
      onResult?.(finalContent);
    }
  };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      buffer += decoder.decode(chunk.value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
  }
  if (buffer.trim()) handleLine(buffer);

  return finalContent;
}

/** Narrows an unknown thrown value to a user-presentable message. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
