"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { Provider } from "@/lib/orchestrate-client";

const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Gemini",
  anthropic: "Claude",
  openai: "OpenAI"
};

export function ProviderModelPicker({
  provider,
  model,
  onProviderChange,
  onModelChange
}: {
  provider: Provider;
  model: string;
  onProviderChange: (provider: Provider) => void;
  onModelChange: (model: string) => void;
}) {
  return (
    <div className="form-row" style={{ alignItems: "center" }}>
      <select
        className="form-select"
        style={{ maxWidth: 160 }}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as Provider)}
        aria-label="AI provider"
      >
        {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
          <option key={p} value={p}>
            {PROVIDER_LABELS[p]}
          </option>
        ))}
      </select>
      <input
        className="form-input"
        style={{ maxWidth: 260 }}
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        aria-label="Model"
      />
      <Link href="/settings/integrations" className="btn-ghost btn-sm">
        <Settings size={14} aria-hidden />
        <span>Org keys</span>
      </Link>
    </div>
  );
}
