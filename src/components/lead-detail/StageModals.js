import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import FormField from '../FormField';
import SearchableSelect from '../SearchableSelect';
import { formatCurrency } from '../../utils/crm';

/** Ask why a lead was lost before moving it to "lost". */
export function LostReasonModal({ open, reasons = [], initialReason, saving, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason(initialReason || '');
      setNote('');
      setError('');
    }
  }, [open, initialReason]);

  const submit = (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Choose a reason so the team can learn from it');
      return;
    }
    onSubmit({ lost_reason: reason, status_note: note.trim() || undefined });
  };

  return (
    <Modal
      open={open}
      title="Mark lead as lost"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ld-lost-form" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Mark as lost'}
          </button>
        </>
      }
    >
      <form id="ld-lost-form" className="ld-modal-form" onSubmit={submit} noValidate>
        <FormField label="Lost reason *" error={error}>
          <SearchableSelect
            value={reason}
            options={reasons}
            placeholder="Select a reason"
            invalid={Boolean(error)}
            onChange={(val) => {
              setReason(val || '');
              setError('');
            }}
          />
        </FormField>
        <FormField label="Note" hint="Optional — shown on the timeline">
          <textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" />
        </FormField>
      </form>
    </Modal>
  );
}

/** Confirm the final deal value when a lead is won. */
export function WonModal({ open, dealValue, currency, saving, onClose, onSubmit }) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValue(dealValue != null ? String(dealValue) : '');
      setNote('');
      setError('');
    }
  }, [open, dealValue]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && (!Number.isFinite(Number(trimmed)) || Number(trimmed) < 0)) {
      setError('Enter a valid amount');
      return;
    }
    onSubmit({
      deal_value: trimmed === '' ? null : Number(trimmed),
      status_note: note.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      title="Mark lead as won"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ld-won-form" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Mark as won'}
          </button>
        </>
      }
    >
      <form id="ld-won-form" className="ld-modal-form" onSubmit={submit} noValidate>
        <FormField
          label="Final deal value"
          error={error}
          hint={value && !error ? formatCurrency(value, { currency }) : 'Leave empty if unknown'}
        >
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={value}
            className={error ? 'invalid' : ''}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            placeholder="0"
          />
        </FormField>
        <FormField label="Note" hint="Optional — shown on the timeline">
          <textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was it closed?" />
        </FormField>
      </form>
    </Modal>
  );
}
