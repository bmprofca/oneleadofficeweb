import React from 'react';
import { FiThermometer, FiX } from 'react-icons/fi';
import { stageMeta, TEMPERATURES } from '../../utils/crm';

/** Pipeline stage pill. Reuses the global .status-* colours. */
export function StageBadge({ status, onClick, title }) {
  const meta = stageMeta(status);
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`status status-${status} ${onClick ? 'status-clickable' : ''}`}
      onClick={onClick}
      title={title}
    >
      {meta.label}
    </Tag>
  );
}

export function TemperatureBadge({ temperature, score, showScore = false }) {
  if (!temperature) return <span className="crm-muted">—</span>;
  const meta = TEMPERATURES[temperature];
  return (
    <span className={`temp-badge tone-${meta.tone}`} title={score !== undefined ? `Lead score ${score}/100` : undefined}>
      <FiThermometer size={12} />
      {meta.label}
      {showScore && score !== undefined ? <em>{score}</em> : null}
    </span>
  );
}

/** Circular 0–100 score gauge. */
export function ScoreRing({ score = 0, size = 44 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = pct >= 60 ? 'rose' : pct >= 30 ? 'amber' : 'sky';
  return (
    <span className={`score-ring tone-${tone}`} style={{ width: size, height: size }} title={`Lead score ${pct}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="score-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="score-ring-value"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <strong>{pct}</strong>
    </span>
  );
}

export function TagChip({ tag, onRemove }) {
  return (
    <span className={`tag-chip tone-${tag.color || 'slate'}`}>
      {tag.name}
      {onRemove ? (
        <button type="button" onClick={() => onRemove(tag)} aria-label={`Remove tag ${tag.name}`}>
          <FiX size={11} />
        </button>
      ) : null}
    </span>
  );
}

export function TagList({ tags = [], max = 3, onRemove }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <span className="tag-list">
      {shown.map((t) => (
        <TagChip key={t.id} tag={t} onRemove={onRemove} />
      ))}
      {extra > 0 ? <span className="tag-chip tone-slate" title={tags.slice(max).map((t) => t.name).join(', ')}>+{extra}</span> : null}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-state-icon">
          <Icon size={20} />
        </span>
      ) : null}
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action || null}
    </div>
  );
}
