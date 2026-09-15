import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiUpload,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiUserCheck,
  FiCalendar,
  FiBell,
  FiLayers,
  FiMoreHorizontal,
  FiX,
  FiEye,
  FiUsers,
  FiUserPlus,
  FiAward,
  FiAlertCircle,
  FiActivity,
  FiFile,
  FiCheck,
  FiMessageCircle,
  FiPlus,
} from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ActionMenu from '../components/ActionMenu';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import Checkbox from '../components/Checkbox';
import SearchableSelect from '../components/SearchableSelect';
import DateTimePicker from '../components/DateTimePicker';
import FormField from '../components/FormField';
import RefreshButton from '../components/RefreshButton';
import { LeadsSkeleton, SkeletonTable } from '../components/Skeleton';
import { formatDateTime, formatOptionLabel, parseAppDate } from '../utils/format';
import { loadProductsOptions, loadUsersOptions } from '../utils/apiSelect';
import {
  clearFieldError,
  isEmpty,
  validateForm,
  validators,
} from '../utils/validation';

const statuses = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'not_interested',
];
const statusOptions = statuses.map((s) => ({ value: s, label: formatOptionLabel(s) }));
const platformOptions = ['call', 'meet', 'zoom', 'teams', 'in_person', 'other'].map((p) => ({
  value: p,
  label: formatOptionLabel(p),
}));

const formatCallback = (value) => {
  if (!value) return null;
  const date = parseAppDate(value);
  if (!date) return null;
  return {
    label: formatDateTime(date, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    overdue: date.getTime() < Date.now(),
  };
};

const loadBulkAssigneeOptions = async (args) => {
  const result = await loadUsersOptions(args);
  if ((args.page || 1) === 1) {
    return {
      ...result,
      items: [{ value: '__none__', label: 'Unassigned' }, ...result.items],
    };
  }
  return result;
};

const loadAssigneeFilterOptions = async (args) => {
  const result = await loadUsersOptions(args);
  if ((args.page || 1) === 1) {
    return {
      ...result,
      items: [{ value: 'unassigned', label: 'Unassigned' }, ...result.items],
    };
  }
  return result;
};

const emptyReminder = { title: '', description: '', remind_at: '', product_id: '' };
const emptyAppointment = {
  title: '',
  description: '',
  location: '',
  platform: 'call',
  start_at: '',
  end_at: '',
  assigned_to: '',
  product_id: '',
};
const emptyEdit = {
  name: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  product_id: '',
  assigned_to: '',
  notes: '',
};

export default function Leads() {
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || ''
  );
  const [productFilter, setProductFilter] = useState(
    searchParams.get('product_id') || ''
  );
  const [productFilterLabel, setProductFilterLabel] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [assignedFilterLabel, setAssignedFilterLabel] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    product_id: '',
    assigned_to: '',
    status: 'new',
    notes: '',
  });
  const [createProductLabel, setCreateProductLabel] = useState('');
  const [createAssigneeLabel, setCreateAssigneeLabel] = useState('');
  const [importProductIds, setImportProductIds] = useState([]);
  const [importProductLabels, setImportProductLabels] = useState([]);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [selected, setSelected] = useState([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState(null);

  const [manageLead, setManageLead] = useState(null);
  const [manageMode, setManageMode] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'new', note: '' });
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editProductLabel, setEditProductLabel] = useState('');
  const [editAssigneeLabel, setEditAssigneeLabel] = useState('');
  const [reminderForm, setReminderForm] = useState(emptyReminder);
  const [reminderProductLabel, setReminderProductLabel] = useState('');
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [appointmentProductLabel, setAppointmentProductLabel] = useState('');
  const [appointmentAssigneeLabel, setAppointmentAssigneeLabel] = useState('');
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkStatusNote, setBulkStatusNote] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [statusHistory, setStatusHistory] = useState([]);
  const [reminderHistory, setReminderHistory] = useState([]);
  const [appointmentHistory, setAppointmentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchTimer = useRef(null);

  const allSelected = useMemo(
    () => leads.length > 0 && selected.length === leads.length,
    [leads, selected]
  );
  const someSelected = selected.length > 0 && !allSelected;

  const buildParams = (overrides = {}) => {
    const params = {
      page: overrides.page ?? page,
      limit: overrides.limit ?? limit,
    };
    const s = overrides.search ?? search;
    const st = overrides.status ?? statusFilter;
    const pr = overrides.product_id ?? productFilter;
    const af = overrides.assigned_to ?? assignedFilter;
    if (s) params.search = s;
    if (st) params.status = st;
    if (pr) params.product_id = pr;
    if (af) params.assigned_to = af;
    return params;
  };

  const loadStats = async (overrides = {}) => {
    try {
      const params = { ...buildParams(overrides) };
      delete params.page;
      delete params.limit;
      delete params.status;
      const { data } = await api.get('/leads/stats', { params });
      setStats(data);
    } catch {
      /* non-blocking */
    }
  };

  const loadLeads = async (overrides = {}) => {
    setTableLoading(true);
    try {
      if (!leads.length) setLoading(true);
      const params = buildParams(overrides);
      const { data } = await api.get('/leads', { params });
      setLeads(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
      setSelected([]);
      setFabOpen(false);
      await loadStats(overrides);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load leads');
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const fromProduct = searchParams.get('product_id') || '';
    const fromStatus = searchParams.get('status') || '';
    setProductFilter(fromProduct);
    setStatusFilter(fromStatus);
    if (!fromProduct) {
      setProductFilterLabel('');
      return undefined;
    }

    let cancelled = false;
    api
      .get(`/products/${fromProduct}`)
      .then(({ data }) => {
        if (!cancelled) setProductFilterLabel(data?.name || '');
      })
      .catch(() => {
        if (!cancelled) setProductFilterLabel('');
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    loadLeads({ page: 1 });
  }, [productFilter, statusFilter, assignedFilter, limit]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadLeads({ page: 1, search });
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const toggleOne = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = (checked) => {
    if (!checked) setSelected([]);
    else setSelected(leads.map((l) => l.id));
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        product_ids: [
          validators.arrayMin(1, 'Select at least one product'),
        ],
        file: [
          validators.custom((value) =>
            value ? '' : 'Please choose an Excel or CSV file'
          ),
        ],
      },
      { product_ids: importProductIds, file }
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('product_ids', JSON.stringify(importProductIds));
      const { data } = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(
        `Imported ${data.imported} · Duplicates ignored ${data.duplicates} · Skipped ${data.skipped}`
      );
      setFile(null);
      setImportProductIds([]);
      setImportProductLabels([]);
      setFormErrors({});
      setImportOpen(false);
      loadLeads({ page: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const openManage = (lead, mode) => {
    setManageLead(lead);
    setManageMode(mode);
    setFormErrors({});
    if (mode === 'status') setStatusForm({ status: lead.status || 'new', note: '' });
    if (mode === 'edit') {
      setEditForm({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        address: lead.address || '',
        website: lead.website || '',
        product_id: lead.product_id != null ? String(lead.product_id) : '',
        assigned_to: lead.assigned_to != null ? String(lead.assigned_to) : '',
        notes: lead.notes || '',
      });
      setEditProductLabel(lead.product_name || '');
      setEditAssigneeLabel(lead.assigned_name || '');
    }
    if (mode === 'reminder') {
      setReminderForm({
        ...emptyReminder,
        title: `Callback: ${lead.name}`,
        product_id: lead.product_id != null ? String(lead.product_id) : '',
      });
      setReminderProductLabel(lead.product_name || '');
    }
    if (mode === 'appointment') {
      setAppointmentForm({
        ...emptyAppointment,
        title: `Meeting with ${lead.name}`,
        assigned_to: lead.assigned_to || '',
        product_id: lead.product_id != null ? String(lead.product_id) : '',
      });
      setAppointmentProductLabel(lead.product_name || '');
      setAppointmentAssigneeLabel(lead.assigned_name || '');
    }
    if (mode === 'status' || mode === 'reminder' || mode === 'appointment') {
      loadManageHistory(lead, mode);
    }
  };

  const loadManageHistory = async (lead, mode) => {
    if (!lead?.id) return;
    setHistoryLoading(true);
    if (mode === 'status') setStatusHistory([]);
    if (mode === 'reminder') setReminderHistory([]);
    if (mode === 'appointment') setAppointmentHistory([]);
    try {
      if (mode === 'status') {
        const { data } = await api.get(`/leads/${lead.id}/status-history`);
        setStatusHistory(Array.isArray(data) ? data : []);
      } else if (mode === 'reminder') {
        const { data } = await api.get('/reminders', { params: { lead_id: lead.id } });
        setReminderHistory(Array.isArray(data) ? data : []);
      } else if (mode === 'appointment') {
        const { data } = await api.get('/appointments', { params: { lead_id: lead.id } });
        setAppointmentHistory(Array.isArray(data) ? data : []);
      }
    } catch {
      /* non-blocking */
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeManage = () => {
    setManageMode(null);
    setManageLead(null);
    setFormErrors({});
  };

  const saveStatus = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        status: [
          validators.required('Status is required'),
          validators.oneOf(statuses, 'Select a valid status'),
        ],
      },
      statusForm
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.put(`/leads/${manageLead.id}`, {
        status: statusForm.status,
        status_note: statusForm.note || null,
      });
      toast.success('Status updated');
      await loadManageHistory(manageLead, 'status');
      closeManage();
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const toggleWhatsapp = async (lead) => {
    const next = lead.whatsapp_active ? 0 : 1;
    try {
      await api.put(`/leads/${lead.id}`, { whatsapp_active: next });
      setLeads((prev) =>
        prev.map((row) =>
          row.id === lead.id ? { ...row, whatsapp_active: next } : row
        )
      );
      toast.success(next ? 'WhatsApp marked active' : 'WhatsApp marked inactive');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update WhatsApp');
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        name: [
          validators.required('Name is required'),
          validators.minLength(2, 'Name must be at least 2 characters'),
        ],
        email: [validators.email('Enter a valid email address')],
        website: [validators.url('Enter a valid website URL')],
        phone: [
          validators.custom((value) => {
            if (isEmpty(value)) return '';
            const digits = String(value).replace(/\D/g, '');
            return digits.length >= 7 ? '' : 'Enter a valid phone number';
          }),
        ],
      },
      editForm
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.put(`/leads/${manageLead.id}`, {
        ...editForm,
        assigned_to: hasRole('admin') ? editForm.assigned_to || null : undefined,
        product_id: editForm.product_id || null,
      });
      toast.success('Lead details updated');
      closeManage();
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const saveReminder = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        product_id: [validators.required('Please select a product')],
        remind_at: [
          validators.required('Callback date and time is required'),
          validators.datetime('Select a valid date and time'),
        ],
      },
      reminderForm
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.post('/reminders', {
        ...reminderForm,
        lead_id: manageLead.id,
        remind_at: String(reminderForm.remind_at || '').replace('T', ' '),
      });
      toast.success('Callback reminder created');
      await loadManageHistory(manageLead, 'reminder');
      closeManage();
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create reminder');
    }
  };

  const saveAppointment = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        product_id: [validators.required('Please select a product')],
        title: [
          validators.required('Title is required'),
          validators.minLength(2, 'Title must be at least 2 characters'),
        ],
        platform: [
          validators.required('Platform is required'),
          validators.oneOf(
            ['call', 'meet', 'zoom', 'teams', 'in_person', 'other'],
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
      },
      appointmentForm
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.post('/appointments', {
        ...appointmentForm,
        lead_id: manageLead.id,
        assigned_to: hasRole('admin')
          ? appointmentForm.assigned_to || null
          : undefined,
        start_at: String(appointmentForm.start_at || '').replace('T', ' '),
        end_at: appointmentForm.end_at
          ? String(appointmentForm.end_at).replace('T', ' ')
          : null,
      });
      toast.success('Appointment scheduled');
      await loadManageHistory(manageLead, 'appointment');
      closeManage();
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create appointment');
    }
  };

  const handleDelete = (id, name) => {
    setConfirmDelete({ type: 'lead', id, name: name || 'this lead' });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === 'lead') {
        await api.delete(`/leads/${confirmDelete.id}`);
        toast.success('Lead deleted');
      } else if (confirmDelete.type === 'bulk') {
        const { data } = await api.post('/leads/bulk', {
          ids: confirmDelete.ids,
          action: 'delete',
        });
        toast.success(data.message || 'Bulk action completed');
        setSelected([]);
        setFabOpen(false);
      }
      setConfirmDelete(null);
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const runBulk = async (action, payload = {}) => {
    if (!selected.length) return toast.error('Select at least one lead');
    try {
      const { data } = await api.post('/leads/bulk', {
        ids: selected,
        action,
        ...payload,
      });
      toast.success(data.message || 'Bulk action completed');
      setSelected([]);
      setBulkModal(null);
      setFabOpen(false);
      setBulkAssignTo('');
      setBulkStatus('');
      setBulkStatusNote('');
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk action failed');
    }
  };

  const statCards = [
    { label: 'Total', value: stats?.total || 0, icon: FiUsers, tone: 'teal' },
    { label: 'New', value: stats?.new_count || 0, icon: FiUserPlus, tone: 'sky' },
    { label: 'In progress', value: stats?.in_progress_count || 0, icon: FiActivity, tone: 'amber' },
    { label: 'Won', value: stats?.won_count || 0, icon: FiAward, tone: 'emerald' },
    { label: 'Lost', value: stats?.lost_count || 0, icon: FiAlertCircle, tone: 'rose' },
    { label: 'Unassigned', value: stats?.unassigned_count || 0, icon: FiUserCheck, tone: 'cyan' },
  ];

  if (loading && leads.length === 0) return <LeadsSkeleton />;

  return (
    <div className={`page leads-page ${hasRole('admin') ? 'leads-page-admin' : 'leads-page-sales'}`}>
      <header className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Centralized lead management — import, follow up, and convert.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await loadLeads();
                toast.success('Leads refreshed');
              } catch {
                /* loadLeads already toasts */
              }
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCreateForm({
                name: '',
                phone: '',
                email: '',
                address: '',
                website: '',
                product_id: '',
                assigned_to: '',
                status: 'new',
                notes: '',
              });
              setCreateProductLabel('');
              setCreateAssigneeLabel('');
              setFormErrors({});
              setCreateOpen(true);
            }}
          >
            <FiPlus size={15} />
            Add lead
          </button>
          <button type="button" className="btn primary" onClick={() => {
            setFormErrors({});
            setImportOpen(true);
          }}>
            <FiUpload size={15} />
            Import leads
          </button>
        </div>
      </header>

      <section className="stat-grid stat-grid-compact">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={`stat-card stat-card-sm stat-tone-${card.tone}`}>
              <span className="stat-icon">
                <Icon size={13} />
              </span>
              <div className="stat-card-body">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel leads-panel">
        <div className="leads-toolbar">
          <div className="leads-toolbar-title">
            <h2>All leads</h2>
            <span className="count-chip">{total} total</span>
          </div>

          <div className={`filter-bar ${hasRole('admin') ? 'filter-bar-4' : 'filter-bar-3'}`}>
            <div className="filter-search">
              <FiSearch size={15} />
              <input
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <SearchableSelect
              value={productFilter}
              valueLabel={productFilterLabel}
              placeholder="All Products"
              clearable
              loadOptions={loadProductsOptions}
              onChange={(val, opt) => {
                setPage(1);
                setProductFilter(val);
                setProductFilterLabel(opt?.label || '');
              }}
            />
            <SearchableSelect
              value={statusFilter}
              placeholder="All Statuses"
              clearable
              options={statusOptions}
              onChange={(val) => {
                setPage(1);
                setStatusFilter(val);
              }}
            />
            {hasRole('admin') && (
              <SearchableSelect
                value={assignedFilter}
                valueLabel={assignedFilterLabel}
                placeholder="All Assignees"
                clearable
                loadOptions={loadAssigneeFilterOptions}
                onChange={(val, opt) => {
                  setPage(1);
                  setAssignedFilter(val);
                  setAssignedFilterLabel(opt?.label || '');
                }}
              />
            )}
          </div>
        </div>

        <div className="table-wrap">
          {tableLoading ? (
            <SkeletonTable rows={8} cols={8} />
          ) : (
          <table>
            <thead>
              <tr>
                <th className="check-col">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    ariaLabel="Select all leads"
                  />
                </th>
                <th className="col-name">Name</th>
                <th className="col-product">Product</th>
                <th className="col-contact">Contact</th>
                <th className="col-status">Status</th>
                <th className="col-whatsapp">WhatsApp</th>
                <th className="col-callback">Next callback</th>
                {hasRole('admin') && <th className="col-assigned">Assigned</th>}
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={hasRole('admin') ? 9 : 8}>
                    No leads found. Import an Excel or CSV file to begin.
                  </td>
                </tr>
              )}
              {leads.map((lead) => {
                const callback = formatCallback(lead.next_callback);
                return (
                <tr
                  key={lead.id}
                  className={selected.includes(lead.id) ? 'row-selected' : ''}
                >
                  <td className="check-col">
                    <Checkbox
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      ariaLabel={`Select ${lead.name}`}
                    />
                  </td>
                  <td className="col-name">
                    <strong>{lead.name}</strong>
                    {lead.address ? (
                      <div>
                        <small>{lead.address}</small>
                      </div>
                    ) : null}
                  </td>
                  <td className="col-product">{lead.product_name || '—'}</td>
                  <td className="col-contact">
                    <div>{lead.phone || '—'}</div>
                    {lead.email ? <small>{lead.email}</small> : null}
                  </td>
                  <td className="col-status">
                    <button
                      type="button"
                      className={`status status-${lead.status} status-clickable`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openManage(lead, 'status');
                      }}
                    >
                      {formatOptionLabel(lead.status)}
                    </button>
                  </td>
                  <td className="col-whatsapp">
                    <button
                      type="button"
                      className={`whatsapp-toggle ${
                        lead.whatsapp_active ? 'active' : 'inactive'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWhatsapp(lead);
                      }}
                      title={
                        lead.whatsapp_active
                          ? 'WhatsApp active — click to mark inactive'
                          : 'WhatsApp inactive — click to mark active'
                      }
                      aria-label={
                        lead.whatsapp_active
                          ? 'WhatsApp active — click to mark inactive'
                          : 'WhatsApp inactive — click to mark active'
                      }
                      aria-pressed={!!lead.whatsapp_active}
                    >
                      <FiMessageCircle size={16} />
                      <span
                        className={`whatsapp-check-badge ${
                          lead.whatsapp_active ? 'checked' : ''
                        }`}
                        aria-hidden="true"
                      >
                        {lead.whatsapp_active ? (
                          <FiCheck size={9} strokeWidth={3} />
                        ) : null}
                      </span>
                    </button>
                  </td>
                  <td className="col-callback">
                    {callback ? (
                      <button
                        type="button"
                        className={`callback-cell callback-clickable ${
                          callback.overdue ? 'overdue' : 'upcoming'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openManage(lead, 'reminder');
                        }}
                      >
                        {callback.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn small callback-set-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openManage(lead, 'reminder');
                        }}
                      >
                        <FiBell size={12} />
                        Set reminder
                      </button>
                    )}
                  </td>
                  {hasRole('admin') && (
                    <td className="col-assigned">
                      {lead.assigned_name || 'Unassigned'}
                    </td>
                  )}
                  <td className="actions-col">
                    <ActionMenu
                      items={[
                        {
                          label: 'View details',
                          icon: <FiEye size={14} />,
                          onClick: () => openManage(lead, 'view'),
                        },
                        {
                          label: 'Change status',
                          icon: <FiLayers size={14} />,
                          onClick: () => openManage(lead, 'status'),
                        },
                        {
                          label: 'Set reminder',
                          icon: <FiBell size={14} />,
                          onClick: () => openManage(lead, 'reminder'),
                        },
                        {
                          label: 'Set appointment',
                          icon: <FiCalendar size={14} />,
                          onClick: () => openManage(lead, 'appointment'),
                        },
                        {
                          label: 'Edit details',
                          icon: <FiEdit2 size={14} />,
                          onClick: () => openManage(lead, 'edit'),
                        },
                        ...(hasRole('admin')
                          ? [
                              {
                                label: 'Delete',
                                icon: <FiTrash2 size={14} />,
                                danger: true,
                                onClick: () => handleDelete(lead.id, lead.name),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={(p) => {
            setPage(p);
            loadLeads({ page: p });
          }}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </section>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            className="fab-wrap"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
          >
            <AnimatePresence>
              {fabOpen && (
                <motion.div
                  className="fab-menu"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  {hasRole('admin') && (
                    <button type="button" onClick={() => setBulkModal('assign')}>
                      <FiUserCheck size={14} /> Assign
                    </button>
                  )}
                  <button type="button" onClick={() => setBulkModal('status')}>
                    <FiLayers size={14} /> Status
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulk('whatsapp', { whatsapp_active: true })}
                  >
                    <FiMessageCircle size={14} /> WhatsApp Active
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulk('whatsapp', { whatsapp_active: false })}
                  >
                    <FiMessageCircle size={14} /> WhatsApp Inactive
                  </button>
                  {hasRole('admin') && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        setConfirmDelete({
                          type: 'bulk',
                          ids: [...selected],
                          name: `${selected.length} lead(s)`,
                        })
                      }
                    >
                      <FiTrash2 size={14} /> Delete
                    </button>
                  )}
                  <button type="button" onClick={() => setSelected([])}>
                    <FiX size={14} /> Clear
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              className="fab-btn"
              onClick={() => setFabOpen((v) => !v)}
            >
              <FiMoreHorizontal size={18} />
              <span>{selected.length}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={createOpen}
        title="Add lead"
        size="lg"
        onClose={() => {
          setCreateOpen(false);
          setFormErrors({});
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCreateOpen(false);
                setFormErrors({});
              }}
            >
              Cancel
            </button>
            <button type="submit" form="create-lead-form" className="btn primary">
              Create lead
            </button>
          </>
        }
      >
        <form
          id="create-lead-form"
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = validateForm(
              {
                name: [
                  validators.required('Name is required'),
                  validators.minLength(2, 'Name must be at least 2 characters'),
                ],
                product_id: [validators.required('Please select a product')],
                email: [validators.email('Enter a valid email address')],
                phone: [
                  validators.custom((value) => {
                    if (!value) return '';
                    const digits = String(value).replace(/\D/g, '');
                    return digits.length >= 7 ? '' : 'Enter a valid phone number';
                  }),
                ],
                status: [
                  validators.required('Status is required'),
                  validators.oneOf(statuses, 'Select a valid status'),
                ],
              },
              createForm
            );
            setFormErrors(result.errors);
            if (!result.valid) return;

            try {
              await api.post('/leads', {
                ...createForm,
                product_id: createForm.product_id,
                assigned_to: hasRole('admin')
                  ? createForm.assigned_to || null
                  : undefined,
              });
              toast.success('Lead created');
              setCreateOpen(false);
              loadLeads({ page: 1 });
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to create lead');
            }
          }}
          noValidate
        >
          <FormField label="Name *" error={formErrors.name}>
            <input
              value={createForm.name}
              onChange={(e) => {
                setCreateForm((p) => ({ ...p, name: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'name'));
              }}
              placeholder="Lead name"
              className={formErrors.name ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Phone" error={formErrors.phone}>
            <input
              value={createForm.phone}
              onChange={(e) => {
                setCreateForm((p) => ({ ...p, phone: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'phone'));
              }}
              placeholder="Mobile number"
              className={formErrors.phone ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Email" error={formErrors.email}>
            <input
              value={createForm.email}
              onChange={(e) => {
                setCreateForm((p) => ({ ...p, email: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'email'));
              }}
              placeholder="Email"
              className={formErrors.email ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Product *" error={formErrors.product_id}>
            <SearchableSelect
              value={createForm.product_id}
              valueLabel={createProductLabel}
              placeholder="Select product"
              loadOptions={loadProductsOptions}
              invalid={Boolean(formErrors.product_id)}
              onChange={(val, opt) => {
                setCreateForm((p) => ({ ...p, product_id: val }));
                setCreateProductLabel(opt?.label || '');
                setFormErrors((prev) => clearFieldError(prev, 'product_id'));
              }}
            />
          </FormField>
          <FormField label="Status" error={formErrors.status}>
            <SearchableSelect
              value={createForm.status}
              options={statusOptions}
              clearable={false}
              invalid={Boolean(formErrors.status)}
              onChange={(val) => {
                setCreateForm((p) => ({ ...p, status: val || 'new' }));
                setFormErrors((prev) => clearFieldError(prev, 'status'));
              }}
            />
          </FormField>
          {hasRole('admin') && (
            <FormField label="Assigned to" error={formErrors.assigned_to}>
              <SearchableSelect
                value={createForm.assigned_to}
                valueLabel={createAssigneeLabel}
                placeholder="Optional — assign sales staff"
                clearable
                loadOptions={loadUsersOptions}
                invalid={Boolean(formErrors.assigned_to)}
                onChange={(val, opt) => {
                  setCreateForm((p) => ({ ...p, assigned_to: val }));
                  setCreateAssigneeLabel(opt?.label || '');
                  setFormErrors((prev) => clearFieldError(prev, 'assigned_to'));
                }}
              />
            </FormField>
          )}
          <FormField label="Website" error={formErrors.website}>
            <input
              value={createForm.website}
              onChange={(e) => setCreateForm((p) => ({ ...p, website: e.target.value }))}
              placeholder="Website"
            />
          </FormField>
          <FormField label="Address" className="full" error={formErrors.address}>
            <textarea
              rows="2"
              value={createForm.address}
              onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Address"
            />
          </FormField>
          <FormField label="Notes" className="full" error={formErrors.notes}>
            <textarea
              rows="3"
              value={createForm.notes}
              onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        open={importOpen}
        title="Import leads"
        onClose={() => {
          setImportOpen(false);
          setFormErrors({});
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setImportOpen(false);
                setFormErrors({});
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="import-form"
              className="btn primary"
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Import file'}
            </button>
          </>
        }
      >
        <form id="import-form" className="form-grid" onSubmit={handleImport} noValidate>
          <FormField label="Products *" className="full" error={formErrors.product_ids}>
            <SearchableSelect
              multiple
              value={importProductIds}
              valueLabels={importProductLabels}
              placeholder="Select one or more products"
              loadOptions={loadProductsOptions}
              invalid={Boolean(formErrors.product_ids)}
              onChange={(vals, items) => {
                setImportProductIds(vals || []);
                setImportProductLabels(items || []);
                setFormErrors((prev) => clearFieldError(prev, 'product_ids'));
              }}
            />
          </FormField>
          <FormField label="Import file *" className="full" error={formErrors.file}>
            <label
              className={`file-dropzone ${file ? 'has-file' : ''} ${
                formErrors.file ? 'invalid' : ''
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="file-dropzone-input"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setFormErrors((prev) => clearFieldError(prev, 'file'));
                }}
              />
              <span className="file-dropzone-icon" aria-hidden>
                {file ? <FiCheck size={22} /> : <FiUpload size={22} />}
              </span>
              <span className="file-dropzone-copy">
                {file ? (
                  <>
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024).toFixed(1)} KB · Click to replace
                    </small>
                  </>
                ) : (
                  <>
                    <strong>Drop file here or browse</strong>
                    <small>
                      <FiFile size={12} /> .xlsx, .xls, or .csv
                    </small>
                  </>
                )}
              </span>
            </label>
          </FormField>
          <p className="hint full">
            Selecting multiple products imports the same sheet for each product.
          </p>
        </form>
      </Modal>

      <Modal
        open={manageMode === 'view'}
        title="Lead details"
        size="lg"
        onClose={closeManage}
        footer={
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() => openManage(manageLead, 'edit')}
            >
              Edit
            </button>
            <button type="button" className="btn" onClick={closeManage}>
              Close
            </button>
          </>
        }
      >
        {manageLead && (
          <div className="detail-grid">
            {[
              ['Name', manageLead.name],
              ['Status', formatOptionLabel(manageLead.status)],
              [
                'WhatsApp',
                manageLead.whatsapp_active ? 'Active' : 'Inactive',
              ],
              ['Product', manageLead.product_name || '—'],
              ['Assigned', manageLead.assigned_name || 'Unassigned'],
              ['Phone', manageLead.phone || '—'],
              ['Email', manageLead.email || '—'],
              ['Website', manageLead.website || '—'],
              ['Category', manageLead.category || '—'],
              ['Address', manageLead.address || '—'],
              ['Source', manageLead.source || '—'],
              ['Open hours', manageLead.open_hours || '—'],
              ['Rating', manageLead.rating || '—'],
              ['Notes', manageLead.notes || '—'],
              ['Lead ID', manageLead.id],
            ].map(([label, value]) => (
              <div key={label} className="detail-item">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={manageMode === 'status'}
        title="Change status"
        onClose={closeManage}
        footer={
          <>
            <button type="button" className="btn" onClick={closeManage}>
              Cancel
            </button>
            <button type="submit" form="status-form" className="btn primary">
              Save status
            </button>
          </>
        }
      >
        <form id="status-form" className="form-grid" onSubmit={saveStatus} noValidate>
          <FormField label="Status" className="full" error={formErrors.status}>
            <SearchableSelect
              value={statusForm.status}
              options={statusOptions}
              clearable={false}
              invalid={Boolean(formErrors.status)}
              onChange={(val) => {
                setStatusForm((prev) => ({ ...prev, status: val || 'new' }));
                setFormErrors((prev) => clearFieldError(prev, 'status'));
              }}
            />
          </FormField>
          <FormField label="Note (optional)" className="full">
            <textarea
              rows="3"
              value={statusForm.note}
              onChange={(e) =>
                setStatusForm((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Optional note about this status change"
            />
          </FormField>
        </form>
        <div className="history-block">
          <h4>Status history</h4>
          {historyLoading ? (
            <p className="history-empty">Loading…</p>
          ) : statusHistory.length === 0 ? (
            <p className="history-empty">No records yet.</p>
          ) : (
            <div className="history-list">
              {statusHistory.map((row) => (
                <div key={row.id} className="history-item">
                  <div className="history-item-top">
                    <strong>
                      {formatOptionLabel(row.from_status || '—')} →{' '}
                      {formatOptionLabel(row.to_status)}
                    </strong>
                    <small className="history-meta">{formatDateTime(row.created_at)}</small>
                  </div>
                  <small className="history-meta">
                    {row.changed_by_name ? `By ${row.changed_by_name}` : 'System'}
                  </small>
                  {row.note ? <p className="history-note">{row.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={manageMode === 'edit'}
        title="Edit lead details"
        size="lg"
        onClose={closeManage}
        footer={
          <>
            <button type="button" className="btn" onClick={closeManage}>
              Cancel
            </button>
            <button type="submit" form="edit-form" className="btn primary">
              Save details
            </button>
          </>
        }
      >
        <form id="edit-form" className="form-grid" onSubmit={saveEdit} noValidate>
          <FormField label="Name *" error={formErrors.name}>
            <input
              value={editForm.name}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, name: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'name'));
              }}
              placeholder="Lead name"
              className={formErrors.name ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Product" error={formErrors.product_id}>
            <SearchableSelect
              value={editForm.product_id}
              valueLabel={editProductLabel}
              placeholder="Select Product"
              loadOptions={loadProductsOptions}
              invalid={Boolean(formErrors.product_id)}
              onChange={(val, opt) => {
                setEditForm((p) => ({ ...p, product_id: val }));
                setEditProductLabel(opt?.label || '');
                setFormErrors((prev) => clearFieldError(prev, 'product_id'));
              }}
            />
          </FormField>
          <FormField label="Phone" error={formErrors.phone}>
            <input
              value={editForm.phone}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, phone: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'phone'));
              }}
              placeholder="Phone number"
              className={formErrors.phone ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Email" error={formErrors.email}>
            <input
              value={editForm.email}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, email: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'email'));
              }}
              placeholder="Email address"
              className={formErrors.email ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Website" error={formErrors.website}>
            <input
              value={editForm.website}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, website: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'website'));
              }}
              placeholder="Website URL"
              className={formErrors.website ? 'invalid' : ''}
            />
          </FormField>
          {hasRole('admin') && (
            <FormField label="Assigned to (sales)" error={formErrors.assigned_to}>
              <SearchableSelect
                value={editForm.assigned_to}
                valueLabel={
                  editForm.assigned_to
                    ? editAssigneeLabel || manageLead?.assigned_name || ''
                    : 'Unassigned'
                }
                placeholder="Unassigned"
                loadOptions={loadUsersOptions}
                invalid={Boolean(formErrors.assigned_to)}
                onChange={(val, opt) => {
                  setEditForm((p) => ({ ...p, assigned_to: val }));
                  setEditAssigneeLabel(opt?.label || '');
                  setFormErrors((prev) => clearFieldError(prev, 'assigned_to'));
                }}
              />
            </FormField>
          )}
          <FormField label="Address" className="full" error={formErrors.address}>
            <textarea
              rows="2"
              value={editForm.address}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, address: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'address'));
              }}
              placeholder="Address"
              className={formErrors.address ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Notes" className="full" error={formErrors.notes}>
            <textarea
              rows="3"
              value={editForm.notes}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, notes: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'notes'));
              }}
              placeholder="Notes"
              className={formErrors.notes ? 'invalid' : ''}
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        open={manageMode === 'reminder'}
        title="Set callback reminder"
        onClose={closeManage}
        footer={
          <>
            <button type="button" className="btn" onClick={closeManage}>
              Cancel
            </button>
            <button type="submit" form="reminder-form" className="btn primary">
              Create reminder
            </button>
          </>
        }
      >
        <form id="reminder-form" className="form-grid" onSubmit={saveReminder} noValidate>
          <FormField label="Lead" className="full">
            <input value={manageLead?.name || ''} disabled />
          </FormField>
          <FormField label="Product *" error={formErrors.product_id}>
            <SearchableSelect
              value={reminderForm.product_id}
              valueLabel={reminderProductLabel}
              placeholder="Select product"
              loadOptions={loadProductsOptions}
              invalid={Boolean(formErrors.product_id)}
              onChange={(val, opt) => {
                setReminderForm((p) => ({ ...p, product_id: val }));
                setReminderProductLabel(opt?.label || '');
                setFormErrors((prev) => clearFieldError(prev, 'product_id'));
              }}
            />
          </FormField>
          <FormField label="Call back at *" error={formErrors.remind_at}>
            <DateTimePicker
              mode="datetime"
              value={reminderForm.remind_at}
              invalid={Boolean(formErrors.remind_at)}
              onChange={(val) => {
                setReminderForm((p) => ({ ...p, remind_at: val }));
                setFormErrors((prev) => clearFieldError(prev, 'remind_at'));
              }}
            />
          </FormField>
          <FormField label="Title" error={formErrors.title}>
            <input
              value={reminderForm.title}
              onChange={(e) => {
                setReminderForm((p) => ({ ...p, title: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'title'));
              }}
              placeholder="Callback title"
              className={formErrors.title ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Notes" className="full" error={formErrors.description}>
            <textarea
              rows="3"
              value={reminderForm.description}
              onChange={(e) => {
                setReminderForm((p) => ({ ...p, description: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'description'));
              }}
              placeholder="Why they asked for a callback"
              className={formErrors.description ? 'invalid' : ''}
            />
          </FormField>
        </form>
        <div className="history-block">
          <h4>Callback reminders</h4>
          {historyLoading ? (
            <p className="history-empty">Loading…</p>
          ) : reminderHistory.length === 0 ? (
            <p className="history-empty">No records yet.</p>
          ) : (
            <div className="history-list">
              {reminderHistory.map((row) => (
                <div key={row.id} className="history-item">
                  <div className="history-item-top">
                    <strong>{row.title || 'Reminder'}</strong>
                    <small className="history-meta">{formatDateTime(row.remind_at)}</small>
                  </div>
                  <small className="history-meta">
                    {row.product_name ? `${row.product_name} · ` : ''}
                    {row.is_completed ? 'Completed' : 'Pending'}
                    {row.user_name ? ` · ${row.user_name}` : ''}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={manageMode === 'appointment'}
        title="Set appointment"
        onClose={closeManage}
        footer={
          <>
            <button type="button" className="btn" onClick={closeManage}>
              Cancel
            </button>
            <button type="submit" form="appointment-form" className="btn primary">
              Create appointment
            </button>
          </>
        }
      >
        <form
          id="appointment-form"
          className="form-grid"
          onSubmit={saveAppointment}
          noValidate
        >
          <FormField label="Lead" className="full">
            <input value={manageLead?.name || ''} disabled />
          </FormField>
          <FormField label="Product *" error={formErrors.product_id}>
            <SearchableSelect
              value={appointmentForm.product_id}
              valueLabel={appointmentProductLabel}
              placeholder="Select product"
              loadOptions={loadProductsOptions}
              invalid={Boolean(formErrors.product_id)}
              onChange={(val, opt) => {
                setAppointmentForm((p) => ({ ...p, product_id: val }));
                setAppointmentProductLabel(opt?.label || '');
                setFormErrors((prev) => clearFieldError(prev, 'product_id'));
              }}
            />
          </FormField>
          <FormField label="Title *" error={formErrors.title}>
            <input
              value={appointmentForm.title}
              onChange={(e) => {
                setAppointmentForm((p) => ({ ...p, title: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'title'));
              }}
              placeholder="Appointment title"
              className={formErrors.title ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Platform" error={formErrors.platform}>
            <SearchableSelect
              value={appointmentForm.platform}
              options={platformOptions}
              clearable={false}
              invalid={Boolean(formErrors.platform)}
              onChange={(val) => {
                setAppointmentForm((p) => ({ ...p, platform: val || 'call' }));
                setFormErrors((prev) => clearFieldError(prev, 'platform'));
              }}
            />
          </FormField>
          {hasRole('admin') && (
            <FormField label="Assigned to (sales)" error={formErrors.assigned_to}>
              <SearchableSelect
                value={appointmentForm.assigned_to}
                valueLabel={appointmentAssigneeLabel}
                placeholder="Optional — assign sales staff"
                clearable
                loadOptions={loadUsersOptions}
                invalid={Boolean(formErrors.assigned_to)}
                onChange={(val, opt) => {
                  setAppointmentForm((p) => ({ ...p, assigned_to: val }));
                  setAppointmentAssigneeLabel(opt?.label || '');
                  setFormErrors((prev) => clearFieldError(prev, 'assigned_to'));
                }}
              />
            </FormField>
          )}
          <FormField label="Start *" error={formErrors.start_at}>
            <DateTimePicker
              mode="datetime"
              value={appointmentForm.start_at}
              invalid={Boolean(formErrors.start_at)}
              onChange={(val) => {
                setAppointmentForm((p) => ({ ...p, start_at: val }));
                setFormErrors((prev) => clearFieldError(prev, 'start_at'));
              }}
            />
          </FormField>
          <FormField label="End" error={formErrors.end_at}>
            <DateTimePicker
              mode="datetime"
              value={appointmentForm.end_at}
              invalid={Boolean(formErrors.end_at)}
              onChange={(val) => {
                setAppointmentForm((p) => ({ ...p, end_at: val }));
                setFormErrors((prev) => clearFieldError(prev, 'end_at'));
              }}
            />
          </FormField>
          <FormField label="Location / link" className="full" error={formErrors.location}>
            <input
              value={appointmentForm.location}
              onChange={(e) => {
                setAppointmentForm((p) => ({ ...p, location: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'location'));
              }}
              placeholder="Office or meeting link"
              className={formErrors.location ? 'invalid' : ''}
            />
          </FormField>
        </form>
        <div className="history-block">
          <h4>Appointments</h4>
          {historyLoading ? (
            <p className="history-empty">Loading…</p>
          ) : appointmentHistory.length === 0 ? (
            <p className="history-empty">No records yet.</p>
          ) : (
            <div className="history-list">
              {appointmentHistory.map((row) => (
                <div key={row.id} className="history-item">
                  <div className="history-item-top">
                    <strong>{row.title || 'Appointment'}</strong>
                    <small className="history-meta">{formatDateTime(row.start_at)}</small>
                  </div>
                  <small className="history-meta">
                    {row.product_name ? `${row.product_name} · ` : ''}
                    {formatOptionLabel(row.status)}
                    {row.assigned_name ? ` · ${row.assigned_name}` : ''}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={bulkModal === 'assign'}
        title={`Assign ${selected.length} lead(s)`}
        onClose={() => {
          setBulkModal(null);
          setFormErrors({});
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBulkModal(null);
                setFormErrors({});
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const result = validateForm(
                  {
                    assigned_to: [
                      validators.required('Select a sales user or Unassigned'),
                    ],
                  },
                  { assigned_to: bulkAssignTo }
                );
                setFormErrors(result.errors);
                if (!result.valid) return;
                runBulk('assign', {
                  assigned_to: bulkAssignTo === '__none__' ? null : bulkAssignTo,
                });
              }}
            >
              Assign
            </button>
          </>
        }
      >
        <FormField label="Assign to" error={formErrors.assigned_to}>
          <SearchableSelect
            value={bulkAssignTo}
            placeholder="Select User"
            loadOptions={loadBulkAssigneeOptions}
            invalid={Boolean(formErrors.assigned_to)}
            onChange={(val) => {
              setBulkAssignTo(val);
              setFormErrors((prev) => clearFieldError(prev, 'assigned_to'));
            }}
          />
        </FormField>
      </Modal>

      <Modal
        open={bulkModal === 'status'}
        title={`Update status for ${selected.length} lead(s)`}
        onClose={() => {
          setBulkModal(null);
          setFormErrors({});
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBulkModal(null);
                setFormErrors({});
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const result = validateForm(
                  {
                    status: [
                      validators.required('Select a status'),
                      validators.oneOf(statuses, 'Select a valid status'),
                    ],
                  },
                  { status: bulkStatus }
                );
                setFormErrors(result.errors);
                if (!result.valid) return;
                runBulk('status', {
                  status: bulkStatus,
                  note: bulkStatusNote || null,
                });
              }}
            >
              Update status
            </button>
          </>
        }
      >
        <FormField label="Status" error={formErrors.status}>
          <SearchableSelect
            value={bulkStatus}
            placeholder="Select Status"
            options={statusOptions}
            invalid={Boolean(formErrors.status)}
            onChange={(val) => {
              setBulkStatus(val);
              setFormErrors((prev) => clearFieldError(prev, 'status'));
            }}
          />
        </FormField>
        <FormField label="Note (optional)" className="full">
          <textarea
            rows="3"
            value={bulkStatusNote}
            onChange={(e) => setBulkStatusNote(e.target.value)}
            placeholder="Optional note for this status change"
          />
        </FormField>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title={
          confirmDelete?.type === 'bulk'
            ? `Delete ${confirmDelete.ids?.length || 0} lead(s)?`
            : 'Delete lead?'
        }
        message={
          confirmDelete?.type === 'bulk'
            ? 'This action cannot be undone.'
            : `Delete "${confirmDelete?.name || 'this lead'}"? This action cannot be undone.`
        }
        loading={deleting}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
      />
    </div>
  );
}
