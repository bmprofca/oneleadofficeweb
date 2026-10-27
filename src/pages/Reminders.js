import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiBell, FiBox, FiCalendar, FiCheck, FiClock, FiEdit2, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
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
import '../styles/reminders.css';
import { loadLeadsOptions, loadUsersOptions } from '../utils/apiSelect';
import { apiError, formatRelative, isOverdue, mapsLink } from '../utils/crm';
import ContactLinks from '../components/crm/ContactLinks';
import OwnerChip from '../components/crm/OwnerChip';
import { useAuth } from '../context/AuthContext';
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
  priority: 'normal',
};

const VIEWS = [
  { key: 'open', label: 'Open', params: { completed: 'false' } },
  { key: 'overdue', label: 'Overdue', params: { due: 'overdue' } },
  { key: 'today', label: 'Today', params: { due: 'today' } },
  { key: 'done', label: 'Done', params: { completed: 'true' } },
  { key: 'all', label: 'All', params: {} },
];

const PRIORITIES = [
  { value: 'high', label: 'High', tone: 'rose' },
  { value: 'normal', label: 'Normal', tone: 'indigo' },
  { value: 'low', label: 'Low', tone: 'slate' },
];

// Date presets for the callback-time filter; "custom" shows From / To pickers.
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};
const DATE_PRESETS = [
  { value: 'any', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'next_7', label: 'Next 7 days' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom range…' },
];

function presetRange(preset, custom) {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { from: ymd(today), to: ymd(today) };
    case 'tomorrow':
      return { from: ymd(addDays(today, 1)), to: ymd(addDays(today, 1)) };
    case 'yesterday':
      return { from: ymd(addDays(today, -1)), to: ymd(addDays(today, -1)) };
    case 'this_week': {
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      return { from: ymd(monday), to: ymd(addDays(monday, 6)) };
    }
    case 'next_7':
      return { from: ymd(today), to: ymd(addDays(today, 6)) };
    case 'last_7':
      return { from: ymd(addDays(today, -6)), to: ymd(today) };
    case 'this_month':
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      };
    case 'custom':
      return { from: custom.from || undefined, to: custom.to || undefined };
    default:
      return {};
  }
}

const schema = {
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
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
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
  const [view, setView] = useState('open');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState('any');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [salesman, setSalesman] = useState('');
  const [salesmanLabel, setSalesmanLabel] = useState('');
  const range = presetRange(datePreset, customRange);
  const rangeInvalid = Boolean(range.from && range.to && range.from > range.to);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setTableLoading(true);
      const viewParams = VIEWS.find((v) => v.key === view)?.params || {};
      const { data } = await api.get('/reminders', {
        params: {
          page,
          limit,
          ...viewParams,
          search: debouncedSearch || undefined,
          from: rangeInvalid ? undefined : range.from,
          to: rangeInvalid ? undefined : range.to,
          assigned_to: isAdmin && salesman ? salesman : undefined,
        },
      });
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
  }, [page, limit, view, debouncedSearch, range.from, range.to, rangeInvalid, salesman, isAdmin]);

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
      priority: item.priority || 'normal',
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

    // The product always follows the lead, so it isn't sent.
    const { product_id: _product, ...rest } = form;
    const payload = {
      ...rest,
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
      if (reminder.is_completed) {
        await api.put(`/reminders/${reminder.id}`, { is_completed: 0 });
      } else {
        await api.post(`/reminders/${reminder.id}/complete`);
        toast.success('Marked as called');
      }
      load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update'));
    }
  };

  const snooze = async (reminder, minutes, label) => {
    try {
      await api.post(`/reminders/${reminder.id}/snooze`, { minutes });
      toast.success(`Snoozed ${label}`);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to snooze'));
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
        <div className="leads-toolbar">
          <div className="leads-toolbar-title">
            <h2>Callback list</h2>
            <span className="count-chip">{total} {view === 'all' ? 'total' : VIEWS.find((v) => v.key === view)?.label.toLowerCase()}</span>
          </div>
          <div className="rem-toolbar">
            <div className="segmented" role="tablist" aria-label="Filter reminders">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={view === v.key}
                  className={view === v.key ? 'active' : ''}
                  onClick={() => {
                    setView(v.key);
                    setPage(1);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="filter-search rem-search">
              <FiSearch size={15} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search lead, phone or title…"
              />
            </div>
          </div>
          <div className="rem-filters">
            <div className="rem-filter">
              <FiCalendar size={14} aria-hidden="true" />
              <SearchableSelect
                className="rem-filter-select"
                value={datePreset}
                options={DATE_PRESETS}
                clearable={datePreset !== 'any'}
                searchable={false}
                onChange={(val) => {
                  setDatePreset(val || 'any');
                  setPage(1);
                }}
              />
            </div>
            {datePreset === 'custom' ? (
              <div className="rem-range">
                <DateTimePicker
                  mode="date"
                  placeholder="From date"
                  value={customRange.from}
                  invalid={rangeInvalid}
                  onChange={(val) => {
                    setCustomRange((r) => ({ ...r, from: val }));
                    setPage(1);
                  }}
                />
                <span className="rem-range-sep">to</span>
                <DateTimePicker
                  mode="date"
                  placeholder="To date"
                  value={customRange.to}
                  invalid={rangeInvalid}
                  onChange={(val) => {
                    setCustomRange((r) => ({ ...r, to: val }));
                    setPage(1);
                  }}
                />
              </div>
            ) : null}
            {isAdmin ? (
              <div className="rem-filter">
                <SearchableSelect
                  className="rem-filter-select"
                  value={salesman}
                  valueLabel={salesmanLabel}
                  placeholder="All salesmen"
                  searchPlaceholder="Search salesman…"
                  loadOptions={loadUsersOptions}
                  onChange={(val, opt) => {
                    setSalesman(val || '');
                    setSalesmanLabel(opt?.label || '');
                    setPage(1);
                  }}
                />
              </div>
            ) : null}
            {rangeInvalid ? <span className="rem-range-error">“From” date is after “To” date</span> : null}
          </div>
        </div>
        <div className="table-wrap">
          {tableLoading ? (
            <SkeletonTable rows={8} cols={isAdmin ? 9 : 8} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="col-serial">#</th>
                  <th>Product</th>
                  <th>Lead</th>
                  <th>Phone</th>
                  <th>Title</th>
                  {isAdmin && <th>Salesman</th>}
                  <th>Call back at</th>
                  <th>Status</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8}>
                      {datePreset !== 'any' || debouncedSearch || salesman
                        ? 'No reminders match these filters.'
                        : 'No callback reminders yet.'}
                    </td>
                  </tr>
                )}
                {reminders.map((item, index) => (
                  <tr key={item.id} className={item.is_completed ? 'row-muted' : ''}>
                    <td className="col-serial">{(page - 1) * limit + index + 1}</td>
                    <td>{item.product_name || '—'}</td>
                    <td>
                      <Link to={`/leads/${encodeURIComponent(item.lead_id)}`} className="rem-lead-link">
                        <strong>{item.lead_name}</strong>
                      </Link>
                    </td>
                    <td>
                      <div>{item.lead_phone || '—'}</div>
                      <ContactLinks
                        className="rem-contact-links"
                        phone={item.lead_phone}
                        name={item.lead_name}
                        map={mapsLink(item, 'lead_')}
                      />
                    </td>
                    <td>
                      <span
                        className={`tone-dot tone-${
                          PRIORITIES.find((p) => p.value === item.priority)?.tone || 'indigo'
                        }`}
                        title={`${item.priority || 'normal'} priority`}
                      />{' '}
                      <strong>{item.title}</strong>
                      {item.description ? (
                        <div>
                          <small>{item.description}</small>
                        </div>
                      ) : null}
                    </td>
                    {isAdmin && (
                      <td>
                        <OwnerChip name={item.lead_assigned_name || item.user_name} />
                      </td>
                    )}
                    <td>
                      <span
                        className={
                          !item.is_completed && isOverdue(item.remind_at) ? 'rem-overdue' : undefined
                        }
                        title={formatDateTime(item.remind_at)}
                      >
                        {formatDateTime(item.remind_at)}
                      </span>
                      {!item.is_completed ? (
                        <small className="rem-relative">{formatRelative(item.remind_at)}</small>
                      ) : null}
                    </td>
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
                          ...(item.is_completed
                            ? []
                            : [
                                {
                                  label: 'Snooze 1 hour',
                                  icon: <FiClock size={14} />,
                                  onClick: () => snooze(item, 60, '1 hour'),
                                },
                                {
                                  label: 'Snooze until tomorrow',
                                  icon: <FiClock size={14} />,
                                  onClick: () => snooze(item, 24 * 60, 'until tomorrow'),
                                },
                              ]),
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
          <FormField label="Lead *" error={errors.lead_id}>
            <SearchableSelect
              value={form.lead_id}
              valueLabel={leadLabel}
              placeholder="Select lead to call back"
              loadOptions={loadLeadsOptions}
              invalid={Boolean(errors.lead_id)}
              onChange={(val, opt) => {
                setForm((prev) => ({ ...prev, lead_id: val, product_id: opt?.product_id || '' }));
                setLeadLabel(opt?.label || '');
                setProductLabel(opt?.product_name || '');
                setErrors((prev) => clearFieldError(prev, 'lead_id'));
              }}
            />
          </FormField>
          <FormField label="Product">
            <div className="field-readonly" title="A callback is always for the lead's product">
              <FiBox size={14} aria-hidden="true" />
              {productLabel || <span className="crm-muted">Select a lead first</span>}
              <small>From the lead</small>
            </div>
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
          <FormField label="Priority">
            <div className="segmented">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={form.priority === p.value ? 'active' : ''}
                  onClick={() => setForm((prev) => ({ ...prev, priority: p.value }))}
                >
                  <span className={`tone-dot tone-${p.tone}`} />
                  {p.label}
                </button>
              ))}
            </div>
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
