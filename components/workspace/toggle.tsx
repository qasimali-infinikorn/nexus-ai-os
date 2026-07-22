"use client";

/**
 * Accessible switch. Uses role="switch" + aria-checked rather than a styled
 * checkbox so screen readers announce on/off state, and stays operable by
 * keyboard (it is a real <button>).
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  name
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <>
      {name ? <input type="hidden" name={name} value={checked ? "on" : "off"} /> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`toggle${checked ? " on" : ""}`}
        onClick={() => onChange?.(!checked)}
      >
        <span className="toggle-knob" aria-hidden />
      </button>
    </>
  );
}
