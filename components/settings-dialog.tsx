"use client";

import React, { useEffect, useId, useRef } from "react";
import { Key, Check, X } from "lucide-react";
import type { ApiKeys, Provider } from "@/lib/orchestrate-client";

const PROVIDER_FIELDS: { prov: Provider; label: string; placeholder: string }[] = [
  { prov: "google", label: "Google Gemini API key", placeholder: "AIzaSy..." },
  { prov: "anthropic", label: "Anthropic Claude API key", placeholder: "sk-ant-..." },
  { prov: "openai", label: "OpenAI API key", placeholder: "sk-proj-..." }
];

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  provider: Provider;
  model: string;
  keys: ApiKeys;
  keyInputs: Record<Provider, string>;
  saveNotice: string;
  onProviderChange: (next: Provider) => void;
  onModelChange: (next: string) => void;
  onKeyInputChange: (prov: Provider, value: string) => void;
  onSave: (e: React.FormEvent) => void;
  onClearKeys: () => void;
  isKeyConfigured: (prov: Provider) => boolean;
}

export default function SettingsDialog({
  open,
  onClose,
  provider,
  model,
  keyInputs,
  saveNotice,
  onProviderChange,
  onModelChange,
  onKeyInputChange,
  onSave,
  onClearKeys,
  isKeyConfigured
}: SettingsDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h2 id={titleId}>
            <Key aria-hidden size={18} style={{ color: "var(--accent)" }} />
            Configure engine
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <form onSubmit={onSave}>
          <div className="form-grid-2" style={{ marginBottom: 18 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-provider">
                Active provider
              </label>
              <select
                id="settings-provider"
                className="form-select"
                value={provider}
                onChange={(e) => onProviderChange(e.target.value as Provider)}
              >
                <option value="google">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI GPT</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="settings-model">
                Model name
              </label>
              <input
                id="settings-model"
                type="text"
                className="form-input"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                placeholder="e.g. gemini-2.5-flash"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="modal-section">
            <p className="form-hint">
              Keys stay in this browser only. They are sent with each request to your local API routes — never stored on a server.
            </p>
            {PROVIDER_FIELDS.map(({ prov, label, placeholder }) => (
              <div className="form-group" key={prov}>
                <label className="form-label form-label-row" htmlFor={`key-${prov}`}>
                  <span>{label}</span>
                  <span
                    className="form-hint"
                    style={{
                      color: isKeyConfigured(prov) ? "var(--accent)" : undefined
                    }}
                  >
                    {isKeyConfigured(prov) ? "Saved" : "Not set"}
                  </span>
                </label>
                <input
                  id={`key-${prov}`}
                  type="password"
                  className="form-input"
                  autoComplete="off"
                  value={keyInputs[prov]}
                  onChange={(e) => onKeyInputChange(prov, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          {saveNotice ? (
            <p className="save-notice" role="status" style={{ marginTop: 16 }}>
              <Check size={16} aria-hidden />
              {saveNotice}
            </p>
          ) : null}

          <div className="modal-footer">
            <button type="button" className="btn-danger btn-sm" onClick={onClearKeys}>
              Delete keys
            </button>
            <div className="actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
