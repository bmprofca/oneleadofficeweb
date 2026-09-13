import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import DateTimePicker from '../components/DateTimePicker';
import ConfirmModal from '../components/ConfirmModal';
import FormField from '../components/FormField';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { PanelTableSkeleton } from '../components/Skeleton';
import { loadLeadsOptions } from '../utils/apiSelect';
import {
  clearFieldError,
  validateForm,
  validators,
} from '../utils/validation';

const emptyForm = {
  title: '',
  description: '',
  remind_at: '',
  lead_id: '',
};

const schema = {
  lead_id: [validators.required('Please select a lead')],
  remind_at: [
    validators.required('Callback date and time is required'),
    validators.datetime('Select a valid date and time'),
  ],
};

const toSqlDateTime = (value) => (value ? String(value).replace('T', ' ') : value);

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [leadLabel, setLeadLabel] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const reminderRes = await api.get('/reminders');
      setReminders(reminderRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => clearFieldError(prev, name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateForm(schema, form);
    setErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.post('/reminders', {
        ...form,
        remind_at: toSqlDateTime(form.remind_at),
      });
      setForm(emptyForm);
      setLeadLabel('');
      setErrors({});
      toast.success('Callback reminder created');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create reminder');
    }
  };

  const toggleComplete = async (reminder) => {
    await api.put(`/reminders/${reminder.id}`, {
      is_completed: reminder.is_completed ? 0 : 1,
    });
    load();
  };

  const handleDelete = (reminder) => {
    setConfirmDelete(reminder);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/reminders/${confirmDelete.id}`);
      toast.success('Reminder deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PanelTableSkeleton rows={6} cols={6} />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Reminders</h1>
          <p>
            Schedule a callback when a lead asks to be called again on a specific date and time.
          </p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await load();
                toast.success('Reminders refreshed');
              } catch {
                /* load toasts */
              }
            }}
          />
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>New callback reminder</h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <FormField label="Lead *" error={errors.lead_id}>
            <SearchableSelect
              value={form.lead_id}
              valueLabel={leadLabel}
              placeholder="Select lead to call back"
              loadOptions={loadLeadsOptions}
              invalid={Boolean(errors.lead_id)}
              onChange={(val, opt) => {
                setForm((prev) => ({ ...prev, lead_id: val }));
                setLeadLabel(opt?.label || '');
                setErrors((prev) => clearFieldError(prev, 'lead_id'));
              }}
            />
          </FormField>
          <FormField label="Call back at *" error={errors.remind_at}>
            <DateTimePicker
              mode="datetime"
              value={form.remind_at}
              invalid={Boolean(errors.remind_at)}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, remind_at: val }));
                setErrors((prev) => clearFieldError(prev, 'remind_at'));
              }}
            />
          </FormField>
          <FormField label="Title" error={errors.title}>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              placeholder="Optional title (defaults to Callback: Lead name)"
              className={errors.title ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Notes" className="full" error={errors.description}>
            <textarea
              name="description"
              rows="3"
              value={form.description}
              onChange={onChange}
              placeholder="Why they asked for a callback / what to discuss"
              className={errors.description ? 'invalid' : ''}
            />
          </FormField>
          <div className="full">
            <button className="btn primary" type="submit">
              Create callback reminder
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Callback list</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Phone</th>
                <th>Title</th>
                <th>Call back at</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reminders.length === 0 && (
                <tr>
                  <td colSpan="6">No callback reminders yet.</td>
                </tr>
              )}
              {reminders.map((item) => (
                <tr key={item.id} className={item.is_completed ? 'row-muted' : ''}>
                  <td>{item.lead_name}</td>
                  <td>{item.lead_phone || '—'}</td>
                  <td>
                    <strong>{item.title}</strong>
                    <div>
                      <small>{item.description}</small>
                    </div>
                  </td>
                  <td>{new Date(item.remind_at).toLocaleString()}</td>
                  <td>{item.is_completed ? 'Done' : 'Pending'}</td>
                  <td className="actions">
                    <button type="button" className="btn small" onClick={() => toggleComplete(item)}>
                      {item.is_completed ? 'Mark pending' : 'Mark called'}
                    </button>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => handleDelete(item)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete reminder?"
        message={
          confirmDelete
            ? `Delete "${confirmDelete.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete reminder"
        loading={deleting}
        onConfirm={confirmDeleteAction}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />
    </div>
  );
}
