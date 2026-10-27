import React, { useEffect, useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import Modal from '../Modal';

export const OUTCOMES = ['Connected', 'No answer', 'Busy', 'Call back later', 'Interested', 'Not interested'];

/** Compact "how did the call go?" dialog. onConfirm({ outcome, note }) — both optional. */
export default function CompleteCallbackModal({ task, saving, onConfirm, onClose }) {
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (task) {
      setOutcome('');
      setNote('');
    }
  }, [task]);

  const submit = (e) => {
    e.preventDefault();
    onConfirm({ outcome: outcome || undefined, note: note.trim() || undefined });
  };

  return (
    <Modal
      open={Boolean(task)}
      size="sm"
      title="Complete callback"
      onClose={() => !saving && onClose()}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={() => onConfirm({})} disabled={saving}>
            Complete without note
          </button>
          <button type="submit" form="md-complete-form" className="btn primary" disabled={saving}>
            <FiCheck size={15} />
            {saving ? 'Saving…' : 'Complete'}
          </button>
        </>
      }
    >
      <form id="md-complete-form" className="md-complete-form" onSubmit={submit} noValidate>
        {task ? (
          <div className="md-complete-lead">
            <strong>{task.lead_name || task.title}</strong>
            {task.title && task.lead_name ? <span>{task.title}</span> : null}
          </div>
        ) : null}
        <div>
          <span className="md-field-label" id="md-outcome-label">
            Outcome
          </span>
          <div className="md-outcomes" role="radiogroup" aria-labelledby="md-outcome-label">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={outcome === o}
                className={`md-outcome${outcome === o ? ' active' : ''}`}
                onClick={() => setOutcome((cur) => (cur === o ? '' : o))}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <label className="md-note">
          <span className="md-field-label">Note</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was discussed? (optional)"
          />
        </label>
      </form>
    </Modal>
  );
}
