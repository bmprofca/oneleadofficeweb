import React, { useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { ACTIVITY_TYPES } from '../../utils/crm';
import { CALL_OUTCOMES } from './helpers';
import { ActivityIcon } from './Timeline';

const DIRECTION_TYPES = ['call', 'whatsapp', 'email'];
const DURATION_TYPES = ['call', 'meeting'];

const PLACEHOLDERS = {
  call: 'What did you discuss? Next steps?',
  whatsapp: 'Summary of the WhatsApp conversation',
  email: 'Summary of the email',
  meeting: 'Meeting notes, decisions, next steps',
  message: 'What was sent or received?',
  note: 'Add a note about this lead…',
};

const initialState = { type: 'call', direction: 'outbound', outcome: '', duration: '', subject: '', content: '' };

/** Log a call / message / meeting / note against the lead. */
export default function ActivityComposer({ disabled = false, saving = false, onSubmit, inputRef }) {
  const [form, setForm] = useState(initialState);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const hasDirection = DIRECTION_TYPES.includes(form.type);
  const hasDuration = DURATION_TYPES.includes(form.type);
  const canSubmit =
    !disabled && !saving && (form.content.trim() || form.outcome || (form.type === 'email' && form.subject.trim()));

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    const minutes = Number(form.duration);
    const payload = {
      type: form.type,
      direction: hasDirection ? form.direction : undefined,
      outcome: form.type === 'call' && form.outcome ? form.outcome : undefined,
      duration_seconds: hasDuration && minutes > 0 ? Math.round(minutes * 60) : undefined,
      subject: form.type === 'email' && form.subject.trim() ? form.subject.trim() : undefined,
      content: form.content.trim() || undefined,
    };
    const ok = await onSubmit(payload);
    if (ok) setForm((f) => ({ ...initialState, type: f.type, direction: f.direction }));
  };

  return (
    <form className="panel ld-composer" onSubmit={submit}>
      <div className="ld-composer-types" role="tablist" aria-label="Activity type">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={form.type === t.key}
            className={`ld-type-btn ${form.type === t.key ? 'active' : ''}`}
            onClick={() => set({ type: t.key, outcome: t.key === 'call' ? form.outcome : '' })}
          >
            <ActivityIcon type={t.key} size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {(hasDirection || hasDuration) && (
        <div className="ld-composer-row">
          {hasDirection ? (
            <div className="segmented ld-segmented-sm" aria-label="Direction">
              {['outbound', 'inbound'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={form.direction === d ? 'active' : ''}
                  onClick={() => set({ direction: d })}
                >
                  {d === 'outbound' ? 'Outgoing' : 'Incoming'}
                </button>
              ))}
            </div>
          ) : null}
          {hasDuration ? (
            <label className="ld-duration">
              <input
                type="number"
                min="0"
                max="1440"
                inputMode="numeric"
                value={form.duration}
                onChange={(e) => set({ duration: e.target.value })}
                placeholder="0"
                aria-label="Duration in minutes"
              />
              <span>min</span>
            </label>
          ) : null}
        </div>
      )}

      {form.type === 'call' ? (
        <div className="ld-outcomes" role="group" aria-label="Call outcome">
          {CALL_OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              className={`ld-chip ${form.outcome === o ? 'active' : ''}`}
              aria-pressed={form.outcome === o}
              onClick={() => set({ outcome: form.outcome === o ? '' : o })}
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}

      {form.type === 'email' ? (
        <input
          className="ld-composer-subject"
          value={form.subject}
          onChange={(e) => set({ subject: e.target.value })}
          placeholder="Subject"
          disabled={disabled}
        />
      ) : null}

      <textarea
        ref={inputRef}
        rows="3"
        value={form.content}
        disabled={disabled}
        onChange={(e) => set({ content: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        placeholder={disabled ? 'This lead is archived — restore it to log activity.' : PLACEHOLDERS[form.type]}
      />

      <div className="ld-composer-footer">
        <span className="ld-hint">Ctrl / ⌘ + Enter to save</span>
        <button type="submit" className="btn primary small" disabled={!canSubmit}>
          <FiSend size={13} />
          {saving ? 'Saving…' : 'Log activity'}
        </button>
      </div>
    </form>
  );
}
