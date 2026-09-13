import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import DateTimePicker from '../components/DateTimePicker';
import ConfirmModal from '../components/ConfirmModal';
import FormField from '../components/FormField';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { PanelTableSkeleton } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { formatOptionLabel } from '../utils/format';
import { loadLeadsOptions, loadUsersOptions } from '../utils/apiSelect';
import {
  clearFieldError,
  isEmpty,
  validateForm,
  validators,
} from '../utils/validation';

const emptyForm = {
  title: '',
  description: '',
  location: '',
  platform: 'call',
  start_at: '',
  end_at: '',
  lead_id: '',
  assigned_to: '',
  status: 'scheduled',
};

const platforms = [
  { value: 'call', label: 'Call' },
  { value: 'meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'in_person', label: 'In Person' },
  { value: 'other', label: 'Other' },
];

const appointmentStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'].map((s) => ({
  value: s,
  label: formatOptionLabel(s),
}));

const schema = {
  title: [
    validators.required('Title is required'),
    validators.minLength(2, 'Title must be at least 2 characters'),
  ],
  platform: [
    validators.required('Platform is required'),
    validators.oneOf(
      platforms.map((p) => p.value),
      'Select a valid platform'
    ),
  ],
  start_at: [
    validators.required('Start date and time is required'),
    validators.datetime('Select a valid start date and time'),
  ],
  end_at: [
    validators.datetime('Select a valid end date and time'),
    validators.custom((value, values) => {
      if (isEmpty(value) || isEmpty(values.start_at)) return '';
      const start = new Date(String(values.start_at).replace(' ', 'T')).getTime();
      const end = new Date(String(value).replace(' ', 'T')).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return '';
      return end < start ? 'End time must be after start time' : '';
    }),
  ],
};

const toSqlDateTime = (value) => (value ? String(value).replace('T', ' ') : value);

export default function Appointments() {
  const { hasRole } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [leadLabel, setLeadLabel] = useState('');
  const [assigneeLabel, setAssigneeLabel] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const appointmentRes = await api.get('/appointments');
      setAppointments(appointmentRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load appointments');
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
      await api.post('/appointments', {
        ...form,
        lead_id: form.lead_id || null,
        assigned_to: hasRole('admin') ? form.assigned_to || null : undefined,
        start_at: toSqlDateTime(form.start_at),
        end_at: form.end_at ? toSqlDateTime(form.end_at) : null,
      });
      setForm(emptyForm);
      setLeadLabel('');
      setAssigneeLabel('');
      setErrors({});
      toast.success('Appointment scheduled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create appointment');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/appointments/${id}`, { status });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = (item) => {
    setConfirmDelete(item);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/appointments/${confirmDelete.id}`);
      toast.success('Appointment deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PanelTableSkeleton rows={6} cols={8} />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Appointments</h1>
          <p>
            {hasRole('admin')
              ? 'Schedule meetings and optionally assign them to sales staff.'
              : 'Your assigned meetings and outcomes.'}
          </p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await load();
                toast.success('Appointments refreshed');
              } catch {
                /* load toasts */
              }
            }}
          />
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Schedule appointment</h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <FormField label="Title *" error={errors.title}>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              placeholder="Appointment title"
              className={errors.title ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Lead" error={errors.lead_id}>
            <SearchableSelect
              value={form.lead_id}
              valueLabel={leadLabel}
              placeholder="Select lead (optional)"
              loadOptions={loadLeadsOptions}
              invalid={Boolean(errors.lead_id)}
              onChange={(val, opt) => {
                setForm((prev) => ({ ...prev, lead_id: val }));
                setLeadLabel(opt?.label || '');
                setErrors((prev) => clearFieldError(prev, 'lead_id'));
              }}
            />
          </FormField>
          {hasRole('admin') && (
            <FormField label="Assigned to (sales)" error={errors.assigned_to}>
              <SearchableSelect
                value={form.assigned_to}
                valueLabel={assigneeLabel}
                placeholder="Optional — assign sales staff"
                clearable
                loadOptions={loadUsersOptions}
                invalid={Boolean(errors.assigned_to)}
                onChange={(val, opt) => {
                  setForm((prev) => ({ ...prev, assigned_to: val }));
                  setAssigneeLabel(opt?.label || '');
                  setErrors((prev) => clearFieldError(prev, 'assigned_to'));
                }}
              />
            </FormField>
          )}
          <FormField label="Platform *" error={errors.platform}>
            <SearchableSelect
              value={form.platform}
              options={platforms}
              clearable={false}
              invalid={Boolean(errors.platform)}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, platform: val || 'call' }));
                setErrors((prev) => clearFieldError(prev, 'platform'));
              }}
            />
          </FormField>
          <FormField label="Location / link" error={errors.location}>
            <input
              name="location"
              value={form.location}
              onChange={onChange}
              placeholder="Office address or meeting link"
              className={errors.location ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Start *" error={errors.start_at}>
            <DateTimePicker
              mode="datetime"
              value={form.start_at}
              invalid={Boolean(errors.start_at)}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, start_at: val }));
                setErrors((prev) => clearFieldError(prev, 'start_at'));
              }}
            />
          </FormField>
          <FormField label="End" error={errors.end_at}>
            <DateTimePicker
              mode="datetime"
              value={form.end_at}
              invalid={Boolean(errors.end_at)}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, end_at: val }));
                setErrors((prev) => clearFieldError(prev, 'end_at'));
              }}
            />
          </FormField>
          <FormField label="Description" className="full" error={errors.description}>
            <textarea
              name="description"
              rows="3"
              value={form.description}
              onChange={onChange}
              placeholder="Meeting agenda or notes"
              className={errors.description ? 'invalid' : ''}
            />
          </FormField>
          <div className="full">
            <button className="btn primary" type="submit">
              Create appointment
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Appointment list</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Lead</th>
                <th>Assigned</th>
                <th>Platform</th>
                <th>When</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 && (
                <tr>
                  <td colSpan="8">No appointments yet.</td>
                </tr>
              )}
              {appointments.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.lead_name || '—'}</td>
                  <td>{item.assigned_name || 'Unassigned'}</td>
                  <td>
                    <span className="status">
                      {platforms.find((p) => p.value === item.platform)?.label ||
                        formatOptionLabel(item.platform || 'call')}
                    </span>
                  </td>
                  <td>{new Date(item.start_at).toLocaleString()}</td>
                  <td>{item.location || '—'}</td>
                  <td>
                    <span className={`status status-${item.status}`}>
                      {formatOptionLabel(item.status)}
                    </span>
                  </td>
                  <td className="actions">
                    <SearchableSelect
                      value={item.status}
                      options={appointmentStatuses}
                      clearable={false}
                      onChange={(val) => updateStatus(item.id, val)}
                    />
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
        title="Delete appointment?"
        message={
          confirmDelete
            ? `Delete "${confirmDelete.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete appointment"
        loading={deleting}
        onConfirm={confirmDeleteAction}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />
    </div>
  );
}
