import React from 'react';

export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </label>
  );
}
