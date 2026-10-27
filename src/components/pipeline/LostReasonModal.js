import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import FormField from '../FormField';

/** Asks why a deal was lost before it is moved into the Lost stage. */
export default function LostReasonModal({ lead, reasons = [], saving, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (lead) {
      setReason('');
      setNote('');
      setError('');
    }
  }, [lead]);

  const submit = (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Choose why this deal was lost');
      return;
    }
    onConfirm({ lost_reason: reason, status_note: note.trim() || undefined });
  };

  return (
    <Modal
      open={Boolean(lead)}
      size="sm"
      title="Mark as lost"
      onClose={() => !saving && onCancel()}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="pl-lost-form" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Mark as lost'}
          </button>
        </>
      }
    >
      <form id="pl-lost-form" className="pl-lost-form" onSubmit={submit} noValidate>
        {lead ? (
          <p className="pl-lost-lead">
            <strong>{lead.name}</strong>
            {lead.product_name ? <span> · {lead.product_name}</span> : null}
          </p>
        ) : null}
        <FormField label="Lost reason *" error={error}>
          <select
            value={reason}
            autoFocus
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            className={error ? 'invalid' : ''}
          >
            <option value="">Select a reason</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Note" hint="Optional — saved on the stage history">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened?"
          />
        </FormField>
      </form>
    </Modal>
  );
}
