"use client";

import type { ComponentType } from "react";
import { useProviderPreference } from "./provider-preference";
import { ProviderModelPicker } from "./provider-model-picker";
import type { AgentPanelProps } from "@/lib/orchestrate-client";

/**
 * Wraps one of the existing feature panels (PRReviewer, ArchitectureStudio,
 * etc.) with a provider/model picker. The panel itself is unchanged from
 * the pre-auth build — it still calls streamOrchestrate with a `keys`
 * object, but that field is now ignored server-side; /api/orchestrate
 * resolves the org's stored provider key from the session instead (see
 * app/api/orchestrate/route.ts).
 */
export function FeaturePanelHost({ Panel }: { Panel: ComponentType<AgentPanelProps> }) {
  const { provider, model, setProvider, setModel } = useProviderPreference();

  return (
    <div className="panel-stack">
      <ProviderModelPicker provider={provider} model={model} onProviderChange={setProvider} onModelChange={setModel} />
      <Panel provider={provider} model={model} keys={{}} />
    </div>
  );
}
