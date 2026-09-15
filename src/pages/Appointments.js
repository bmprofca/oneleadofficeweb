import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../api/client';
import ActionMenu from '../components/ActionMenu';
import ConfirmModal from '../components/ConfirmModal';
import DateTimePicker from '../components/DateTimePicker';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { PanelTableSkeleton, SkeletonTable } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatOptionLabel, parseAppDate } from '../utils/format';
import { loadLeadsOptions, loadProductsOptions, loadUsersOptions } from '../utils/apiSelect';
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
  product_id: '',
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
  product_id: [validators.required('Please select a product')],
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
      const start = parseAppDate(values.start_at)?.getTime();
      const end = parseAppDate(value)?.getTime();
      if (!start || !end) return '';
      return end < start ? 'End time must be after start time' : '';
    }),
  ],
};

const toSqlDateTime = (value) => (value ? String(value).replace('T', ' ') : value);
const toPickerValue = (value) => {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
};

export default function Appointments() {
  const { hasRole } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [leadLabel, setLeadLabel] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [assigneeLabel, setAssigneeLabel] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setTableLoading(true);
      const { data } = await api.get('/appointments', { params: { page, limit } });
      if (Array.isArray(data)) {
        setAppointments(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setAppointments(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => clearFieldError(prev, name));
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setForm(emptyForm);
    setLeadLabel('');
    setProductLabel('');
    setAssigneeLabel('');
    setErrors({});
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLeadLabel('');
    setProductLabel('');
    setAssigneeLabel('');
    setErrors({});
    setModalMode('create');
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      location: item.location || '',
      platform: item.platform || 'call',
      start_at: toPickerValue(item.start_at),
      end_at: toPickerValue(item.end_at),
      lead_id: item.lead_id || '',
      product_id: item.product_id != null ? String(item.product_id) : '',
      assigned_to: item.user_id != null ? String(item.user_id) : '',
      status: item.status || 'scheduled',
    });
    setLeadLabel(item.lead_name || '');
    setProductLabel(item.product_name || '');
    setAssigneeLabel(item.assigned_name || '');
    setErrors({});
    setModalMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateForm(schema, form);
    setErrors(result.errors);
    if (!result.valid) return;

    const payload = {
      ...form,
      lead_id: form.lead_id || null,
      assigned_to: hasRole('admin') ? form.assigned_to || null : undefined,
      start_at: toSqlDateTime(form.start_at),
      end_at: form.end_at ? toSqlDateTime(form.end_at) : null,
    };

    try {
      if (modalMode === 'edit' && editingId) {
        await api.put(`/appointments/${editingId}`, payload);
        toast.success('Appointment updated');
      } else {
        await api.post('/appointments', payload);
        toast.success('Appointment scheduled');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (modalMode === 'edit'
            ? 'Failed to update appointment'
            : 'Failed to create appointment')
      );
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

  if (loading) return <PanelTableSkeleton rows={8} cols={9} />;

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
          <button type="button" className="btn primary" onClick={openCreate}>
            <FiPlus size={16} />
            New appointment
          </button>
        </div>
      </header>

      <section className="panel leads-panel">
        <div className="panel-header">
          <h2>Appointment list</h2>
        </div>
        <div className="table-wrap">
          {tableLoading ? (
            <SkeletonTable rows={8} cols={9} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="col-serial">#</th>
                  <th>Title</th>
                  <th>Product</th>
                  <th>Lead</th>
                  <th>Assigned</th>
                  <th>Platform</th>
                  <th>When</th>
                  <th>Status</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="9">No appointments yet.</td>
                  </tr>
                )}
                {appointments.map((item, index) => (
                  <tr key={item.id}>
                    <td className="col-serial">{(page - 1) * limit + index + 1}</td>
                    <td>
                      <strong>{item.title}</strong>
                      {item.location ? (
                        <div>
                          <small>{item.location}</small>
                        </div>
                      ) : null}
                    </td>
                    <td>{item.product_name || '—'}</td>
                    <td>{item.lead_name || '—'}</td>
                    <td>{item.assigned_name || 'Unassigned'}</td>
                    <td>
                      <span className="status">
                        {platforms.find((p) => p.value === item.platform)?.label ||
                          formatOptionLabel(item.platform || 'call')}
                      </span>
                    </td>
                    <td>{formatDateTime(item.start_at)}</td>
                    <td>
                      <span className={`status status-${item.status}`}>
                        {formatOptionLabel(item.status)}
                      </span>
                    </td>
                    <td className="actions-col">
                      <ActionMenu
                        items={[
                          {
                            label: 'Edit',
                            icon: <FiEdit2 size={14} />,
                            onClick: () => openEdit(item),
                          },
                          ...appointmentStatuses.map((s) => ({
                            label: `Mark ${s.label}`,
                            onClick: () => updateStatus(item.id, s.value),
                          })),
                          {
                            label: 'Delete',
                            icon: <FiTrash2 size={14} />,
                            danger: true,
                            onClick: () => setConfirmDelete(item),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </section>

      <Modal
        open={Boolean(modalMode)}
        title={modalMode === 'edit' ? 'Edit appointment' : 'Schedule appointment'}
        size="lg"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="appointment-form" className="btn primary">
              {modalMode === 'edit' ? 'Save changes' : 'Create appointment'}
            </button>
          </>
        }
      >
        <form
          id="appointment-form"
          className="form-grid"
          onSubmit={handleSubmit}
          noValidate
        >
          <FormField label="Title *" error={errors.title}>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              placeholder="Appointment title"
              className={errors.title ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Product *" error={errors.product_id}>
            <SearchableSelect
              value={form.product_id}
              valueLabel={productLabel}
              placeholder="Select product"
              loadOptions={loadProductsOptions}
              invalid={Boolean(errors.product_id)}
              onChange={(val, opt) => {
                setForm((prev) => ({ ...prev, product_id: val }));
                setProductLabel(opt?.label || '');
                setErrors((prev) => clearFieldError(prev, 'product_id'));
              }}
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
                setForm((prev) => ({
                  ...prev,
                  lead_id: val,
                  product_id: opt?.product_id || prev.product_id,
                }));
                setLeadLabel(opt?.label || '');
                if (opt?.product_id) setProductLabel(opt.product_name || '');
                setErrors((prev) =>
                  clearFieldError(clearFieldError(prev, 'lead_id'), 'product_id')
                );
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
        </form>
      </Modal>

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
