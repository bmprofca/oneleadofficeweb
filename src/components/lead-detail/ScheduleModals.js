import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import FormField from '../FormField';
import DateTimePicker from '../DateTimePicker';
import SearchableSelect from '../SearchableSelect';
import { loadUsersOptions } from '../../utils/apiSelect';
import { parseAppDate } from '../../utils/format';
import { PLATFORM_OPTIONS, pickerDaysAt, pickerFromNow, toApiDateTime } from './helpers';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'normal', label: 'Normal' },
  { key: 'high', label: 'High' },
];

const CALLBACK_PRESETS = [
  { label: 'In 1 hour', value: () => pickerFromNow(60) },
  { label: 'In 3 hours', value: () => pickerFromNow(180) },
  { label: 'Tomorrow 10 AM', value: () => pickerDaysAt(1, 10) },
  { label: 'In 3 days', value: () => pickerDaysAt(3, 10) },
  { label: 'Next week', value: () => pickerDaysAt(7, 10) },
];

/** Schedule a callback reminder on this lead. */
export function CallbackModal({ open, lead, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({ remind_at: '', title: '', priority: 'normal', description: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm({ remind_at: pickerDaysAt(1, 10), title: '', priority: 'normal', description: '' });
      setErrors({});
    }
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.remind_at) next.remind_at = 'Pick when to call back';
    if (!lead?.product_id) next.remind_at = 'This lead has no product — set one in Details first';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      lead_id: lead.id,
      product_id: lead.product_id,
      remind_at: toApiDateTime(form.remind_at),
      title: form.title.trim() || undefined,
      priority: form.priority,
      description: form.description.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      title="Schedule callback"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ld-callback-form" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Schedule callback'}
          </button>
        </>
      }
    >
      <form id="ld-callback-form" className="ld-modal-form" onSubmit={submit} noValidate>
        <div className="ld-presets" role="group" aria-label="Quick times">
          {CALLBACK_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="ld-chip"
              onClick={() => {
                setForm((f) => ({ ...f, remind_at: p.value() }));
                setErrors({});
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <FormField label="Call back at *" error={errors.remind_at}>
          <DateTimePicker
            mode="datetime"
            value={form.remind_at}
            invalid={Boolean(errors.remind_at)}
            onChange={(val) => {
              setForm((f) => ({ ...f, remind_at: val }));
              setErrors({});
            }}
          />
        </FormField>
        <FormField label="Title" hint={`Defaults to “Callback: ${lead?.name || 'lead'}”`}>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Share revised quote"
          />
        </FormField>
        <FormField label="Priority">
          <div className="segmented ld-segmented-fill">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                className={form.priority === p.key ? 'active' : ''}
                onClick={() => setForm((f) => ({ ...f, priority: p.key }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="Notes">
          <textarea
            rows="3"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Why they asked for a callback"
          />
        </FormField>
      </form>
    </Modal>
  );
}

/** Book an appointment / meeting with this lead. */
export function AppointmentModal({ open, lead, isAdmin, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: '',
    platform: 'call',
    start_at: '',
    end_at: '',
    location: '',
    description: '',
    assigned_to: '',
  });
  const [assigneeLabel, setAssigneeLabel] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && lead) {
      setForm({
        title: `Meeting with ${lead.name}`,
        platform: 'call',
        start_at: pickerDaysAt(1, 11),
        end_at: '',
        location: '',
        description: '',
        assigned_to: lead.assigned_to ? String(lead.assigned_to) : '',
      });
      setAssigneeLabel(lead.assigned_name || '');
      setErrors({});
    }
    // Only reset when the modal opens, not when the lead reloads underneath it.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (form.title.trim().length < 2) next.title = 'Title is required';
    if (!form.start_at) next.start_at = 'Pick a start time';
    if (form.start_at && form.end_at) {
      const s = parseAppDate(form.start_at)?.getTime();
      const en = parseAppDate(form.end_at)?.getTime();
      if (s && en && en < s) next.end_at = 'End must be after start';
    }
    if (!lead?.product_id) next.title = 'This lead has no product — set one in Details first';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      lead_id: lead.id,
      product_id: lead.product_id,
      title: form.title.trim(),
      platform: form.platform,
      start_at: toApiDateTime(form.start_at),
      end_at: form.end_at ? toApiDateTime(form.end_at) : null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      ...(isAdmin ? { assigned_to: form.assigned_to || null } : {}),
    });
  };

  return (
    <Modal
      open={open}
      title="Book appointment"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ld-appt-form" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Book appointment'}
          </button>
        </>
      }
    >
      <form id="ld-appt-form" className="form-grid" onSubmit={submit} noValidate>
        <FormField label="Title *" className="full" error={errors.title}>
          <input
            value={form.title}
            className={errors.title ? 'invalid' : ''}
            onChange={(e) => set('title')(e.target.value)}
          />
        </FormField>
        <FormField label="Start *" error={errors.start_at}>
          <DateTimePicker mode="datetime" value={form.start_at} invalid={Boolean(errors.start_at)} onChange={set('start_at')} />
        </FormField>
        <FormField label="End" error={errors.end_at}>
          <DateTimePicker mode="datetime" value={form.end_at} invalid={Boolean(errors.end_at)} onChange={set('end_at')} />
        </FormField>
        <FormField label="Platform">
          <SearchableSelect
            value={form.platform}
            options={PLATFORM_OPTIONS}
            clearable={false}
            onChange={(val) => set('platform')(val || 'call')}
          />
        </FormField>
        {isAdmin ? (
          <FormField label="Assigned to">
            <SearchableSelect
              value={form.assigned_to}
              valueLabel={assigneeLabel}
              placeholder="Sales owner"
              loadOptions={loadUsersOptions}
              onChange={(val, opt) => {
                set('assigned_to')(val || '');
                setAssigneeLabel(opt?.label || '');
              }}
            />
          </FormField>
        ) : null}
        <FormField label="Location / link" className="full">
          <input
            value={form.location}
            onChange={(e) => set('location')(e.target.value)}
            placeholder="Office address or meeting link"
          />
        </FormField>
        <FormField label="Agenda" className="full">
          <textarea
            rows="3"
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            placeholder="What will you cover?"
          />
        </FormField>
      </form>
    </Modal>
  );
}
