import React, { useState } from 'react';
import { FiDollarSign, FiEdit2 } from 'react-icons/fi';
import DateTimePicker from '../DateTimePicker';
import FormField from '../FormField';
import SearchableSelect from '../SearchableSelect';
import { formatCurrency, stageMeta } from '../../utils/crm';
import { daysUntil, formatDateOnly, toDateValue } from './helpers';

export function SideCard({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`panel ld-card ${className}`}>
      <header className="ld-card-header">
        <h2>
          {Icon ? <Icon size={14} aria-hidden="true" /> : null}
          {title}
        </h2>
        {action || null}
      </header>
      {children}
    </section>
  );
}

export function EditButton({ onClick, label = 'Edit' }) {
  return (
    <button type="button" className="btn ghost small ld-card-edit" onClick={onClick}>
      <FiEdit2 size={12} />
      {label}
    </button>
  );
}

export function SaveBar({ saving, onCancel }) {
  return (
    <div className="ld-savebar">
      <button type="button" className="btn small" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <button type="submit" className="btn primary small" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function closeHint(lead) {
  if (!lead.expected_close_date) return null;
  if (['won', 'lost', 'not_interested'].includes(lead.status)) return null;
  const days = daysUntil(lead.expected_close_date);
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`, overdue: true };
  if (days === 0) return { text: 'Today', overdue: false };
  return { text: `in ${days} day${days === 1 ? '' : 's'}`, overdue: false };
}

/** Deal value, close date, weighted forecast and lost reason. */
export default function DealCard({ lead, currency, lostReasons = [], readOnly, onSave }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ deal_value: '', expected_close_date: '', lost_reason: '' });
  const [error, setError] = useState('');

  const meta = stageMeta(lead.status);
  const probability = meta.probability ?? 0;
  const deal = lead.deal_value != null ? Number(lead.deal_value) : null;
  const weighted = deal != null ? (deal * probability) / 100 : null;
  const hint = closeHint(lead);

  const startEdit = () => {
    setForm({
      deal_value: lead.deal_value != null ? String(lead.deal_value) : '',
      expected_close_date: toDateValue(lead.expected_close_date),
      lost_reason: lead.lost_reason || '',
    });
    setError('');
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const raw = form.deal_value.trim();
    if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    const patch = {
      deal_value: raw === '' ? null : Number(raw),
      expected_close_date: form.expected_close_date || null,
    };
    if (lead.status === 'lost') patch.lost_reason = form.lost_reason || null;
    const ok = await onSave(patch, 'Deal updated');
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <SideCard
      title="Deal"
      icon={FiDollarSign}
      action={!editing && !readOnly ? <EditButton onClick={startEdit} /> : null}
    >
      {editing ? (
        <form className="ld-card-form" onSubmit={submit} noValidate>
          <FormField label="Deal value" error={error}>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={form.deal_value}
              className={error ? 'invalid' : ''}
              onChange={(e) => {
                setForm((f) => ({ ...f, deal_value: e.target.value }));
                setError('');
              }}
              placeholder="0"
              autoFocus
            />
          </FormField>
          <FormField label="Expected close">
            <DateTimePicker
              mode="date"
              value={form.expected_close_date}
              onChange={(val) => setForm((f) => ({ ...f, expected_close_date: val }))}
            />
          </FormField>
          {lead.status === 'lost' ? (
            <FormField label="Lost reason">
              <SearchableSelect
                value={form.lost_reason}
                options={lostReasons}
                placeholder="Select a reason"
                onChange={(val) => setForm((f) => ({ ...f, lost_reason: val || '' }))}
              />
            </FormField>
          ) : null}
          <SaveBar saving={saving} onCancel={() => setEditing(false)} />
        </form>
      ) : (
        <>
          <div className="ld-deal-hero">
            <span className="ld-deal-value">{deal != null ? formatCurrency(deal, { currency }) : '—'}</span>
            {deal == null && !readOnly ? (
              <button type="button" className="ld-link-btn" onClick={startEdit}>
                Add deal value
              </button>
            ) : null}
          </div>
          <dl className="kv-list ld-kv">
            <div>
              <dt>Weighted</dt>
              <dd>
                {weighted != null ? formatCurrency(weighted, { currency }) : '—'}
                <span className="ld-kv-sub"> · {probability}% at {meta.label}</span>
              </dd>
            </div>
            <div>
              <dt>Expected close</dt>
              <dd>
                {formatDateOnly(lead.expected_close_date)}
                {hint ? <span className={`ld-kv-sub ${hint.overdue ? 'is-overdue' : ''}`}> · {hint.text}</span> : null}
              </dd>
            </div>
            {lead.status === 'lost' ? (
              <div>
                <dt>Lost reason</dt>
                <dd className="ld-lost-reason">{lead.lost_reason || '—'}</dd>
              </div>
            ) : null}
          </dl>
          <div className="ld-prob-bar" aria-hidden="true">
            <span style={{ width: `${probability}%` }} />
          </div>
        </>
      )}
    </SideCard>
  );
}
