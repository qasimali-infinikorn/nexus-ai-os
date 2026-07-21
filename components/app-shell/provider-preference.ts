"use client";

import { startTransition, useEffect, useState } from "react";
import { isProvider, type Provider } from "@/lib/orchestrate-client";

// Which provider/model a feature panel should call is a per-browser UI
// preference (persisted so it survives reloads); the actual secret used to
// authenticate that call now lives server-side, per-organization (see
// lib/db/queries.ts's getOrgProviderKey and Settings → Integrations) —
// this hook never touches a real API key.
export const DEFAULT_MODELS: Record<Provider, string> = {
  google: "gemini-2.5-flash",
  anthropic: "claude-3-5-sonnet-20241022",
  openai: "gpt-4o"
};

export function useProviderPreference() {
  const [provider, setProviderState] = useState<Provider>("google");
  const [model, setModel] = useState(DEFAULT_MODELS.google);

  useEffect(() => {
    const savedProvider = localStorage.getItem("nexus_provider");
    const savedModel = localStorage.getItem("nexus_model");
    // Hydrate from localStorage after mount (client-only) without triggering
    // a synchronous cascading render — see app/page.tsx's original pattern.
    startTransition(() => {
      if (isProvider(savedProvider)) setProviderState(savedProvider);
      if (savedModel) setModel(savedModel);
    });
  }, []);

  const setProvider = (next: Provider) => {
    setProviderState(next);
    setModel(DEFAULT_MODELS[next]);
    localStorage.setItem("nexus_provider", next);
    localStorage.setItem("nexus_model", DEFAULT_MODELS[next]);
  };

  const updateModel = (next: string) => {
    setModel(next);
    localStorage.setItem("nexus_model", next);
  };

  return { provider, model, setProvider, setModel: updateModel };
}
