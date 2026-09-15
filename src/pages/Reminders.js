import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiBell, FiCheck, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
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
import { formatDateTime } from '../utils/format';
import { loadLeadsOptions, loadProductsOptions } from '../utils/apiSelect';
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
  product_id: '',
};

const schema = {
  product_id: [validators.required('Please select a product')],
  lead_id: [validators.required('Please select a lead')],
  remind_at: [
    validators.required('Callback date and time is required'),
    validators.datetime('Select a valid date and time'),
  ],
};

const toSqlDateTime = (value) => (value ? String(value).replace('T', ' ') : value);
const toPickerValue = (value) => {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
};

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [leadLabel, setLeadLabel] = useState('');
  const [productLabel, setProductLabel] = useState('');
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
      const { data } = await api.get('/reminders', { params: { page, limit } });
      if (Array.isArray(data)) {
        setReminders(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setReminders(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reminders');
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
    setErrors({});
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLeadLabel('');
    setProductLabel('');
    setErrors({});
    setModalMode('create');
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      remind_at: toPickerValue(item.remind_at),
      lead_id: item.lead_id || '',
      product_id: item.product_id != null ? String(item.product_id) : '',
    });
    setLeadLabel(item.lead_name || '');
    setProductLabel(item.product_name || '');
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
      remind_at: toSqlDateTime(form.remind_at),
    };

    try {
      if (modalMode === 'edit' && editingId) {
        await api.put(`/reminders/${editingId}`, payload);
        toast.success('Reminder updated');
      } else {
        await api.post('/reminders', payload);
        toast.success('Callback reminder created');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (modalMode === 'edit' ? 'Failed to update reminder' : 'Failed to create reminder')
      );
    }
  };

  const toggleComplete = async (reminder) => {
    try {
      await api.put(`/reminders/${reminder.id}`, {
        is_completed: reminder.is_completed ? 0 : 1,
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
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

  if (loading) return <PanelTableSkeleton rows={8} cols={8} />;

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
          <button type="button" className="btn primary" onClick={openCreate}>
            <FiPlus size={16} />
            New reminder
          </button>
        </div>
      </header>

      <section className="panel leads-panel">
        <div className="panel-header">
          <h2>Callback list</h2>
        </div>
        <div className="table-wrap">
          {tableLoading ? (
            <SkeletonTable rows={8} cols={8} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="col-serial">#</th>
                  <th>Product</th>
                  <th>Lead</th>
                  <th>Phone</th>
                  <th>Title</th>
                  <th>Call back at</th>
                  <th>Status</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.length === 0 && (
                  <tr>
                    <td colSpan="8">No callback reminders yet.</td>
                  </tr>
                )}
                {reminders.map((item, index) => (
                  <tr key={item.id} className={item.is_completed ? 'row-muted' : ''}>
                    <td className="col-serial">{(page - 1) * limit + index + 1}</td>
                    <td>{item.product_name || '—'}</td>
                    <td>
                      <strong>{item.lead_name}</strong>
                    </td>
                    <td>{item.lead_phone || '—'}</td>
                    <td>
                      <strong>{item.title}</strong>
                      {item.description ? (
                        <div>
                          <small>{item.description}</small>
                        </div>
                      ) : null}
                    </td>
                    <td>{formatDateTime(item.remind_at)}</td>
                    <td>
                      <span
                        className={`status ${
                          item.is_completed ? 'status-won' : 'status-contacted'
                        }`}
                      >
                        {item.is_completed ? 'Done' : 'Pending'}
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
                          {
                            label: item.is_completed ? 'Mark pending' : 'Mark called',
                            icon: item.is_completed ? (
                              <FiBell size={14} />
                            ) : (
                              <FiCheck size={14} />
                            ),
                            onClick: () => toggleComplete(item),
                          },
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
        title={modalMode === 'edit' ? 'Edit reminder' : 'New callback reminder'}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="reminder-form" className="btn primary">
              {modalMode === 'edit' ? 'Save changes' : 'Create reminder'}
            </button>
          </>
        }
      >
        <form
          id="reminder-form"
          className="form-grid"
          onSubmit={handleSubmit}
          noValidate
        >
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
          <FormField label="Lead *" error={errors.lead_id}>
            <SearchableSelect
              value={form.lead_id}
              valueLabel={leadLabel}
              placeholder="Select lead to call back"
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
              placeholder="Optional title"
              className={errors.title ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Notes" className="full" error={errors.description}>
            <textarea
              name="description"
              rows="3"
              value={form.description}
              onChange={onChange}
              placeholder="Why they asked for a callback"
              className={errors.description ? 'invalid' : ''}
            />
          </FormField>
        </form>
      </Modal>

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
