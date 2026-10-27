import React, { useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import { EditButton, SaveBar, SideCard } from './DealCard';

/** Free-text notes stored on the lead record. */
export default function NotesCard({ notes, readOnly, onSave }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(notes || '');
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({ notes: draft.trim() || null }, 'Notes saved');
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <SideCard
      title="Notes"
      icon={FiFileText}
      action={!editing && !readOnly ? <EditButton onClick={startEdit} label={notes ? 'Edit' : 'Add'} /> : null}
    >
      {editing ? (
        <form className="ld-card-form" onSubmit={submit}>
          <textarea
            rows="6"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Background, requirements, key contacts…"
            autoFocus
          />
          <SaveBar saving={saving} onCancel={() => setEditing(false)} />
        </form>
      ) : notes ? (
        <p className="ld-notes ld-prewrap">{notes}</p>
      ) : (
        <p className="ld-card-empty">No notes yet.</p>
      )}
    </SideCard>
  );
}
