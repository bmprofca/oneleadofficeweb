import React from 'react';

export default function FormField({
  label,
  error,
  hint,
  className = '',
  children,
}) {
  return (
    <div className={`form-field ${error ? 'has-error' : ''} ${className}`.trim()}>
      {label ? <span className="form-field-label">{label}</span> : null}
      <div className="form-field-control">{children}</div>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
