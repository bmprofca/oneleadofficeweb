import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiUpload,
  FiSearch,
  FiEdit2,
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
  FiExternalLink,
  FiArchive,
  FiRotateCcw,
  FiDownload,
  FiFilter,
  FiTag,
  FiShuffle,
  FiTrendingUp,
  FiThermometer,
  FiClock,
  FiChevronDown,
  FiBox,
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
  apiError,
  downloadBlob,
  formatCurrency,
  mapsLink,
  sourceLabel,
} from '../utils/crm';
import useAppSettings, { useTags } from '../hooks/useAppSettings';
import { TagList, TemperatureBadge } from '../components/crm/Badges';
import Switch from '../components/crm/Switch';
import ContactLinks from '../components/crm/ContactLinks';
import '../styles/leads-upgrade.css';
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

/** Filters (besides search/product/status/assignee) mirrored in the URL. */
const EXTRA_FILTER_KEYS = [
  'source',
  'tag_id',
  'temperature',
  'callback',
  'created_from',
  'created_to',
  'archived',
  'sort',
];
const URL_FILTER_KEYS = ['status', 'product_id', ...EXTRA_FILTER_KEYS];

const readExtraFilters = (params) =>
  Object.fromEntries(EXTRA_FILTER_KEYS.map((key) => [key, params.get(key) || '']));

const sameFilters = (a, b) => EXTRA_FILTER_KEYS.every((key) => (a[key] || '') === (b[key] || ''));

const canonicalQuery = (params) =>
  [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

const temperatureOptions = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];
const callbackOptions = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'none', label: 'No follow-up' },
];
const sortOptions = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'score', label: 'Score' },
  { value: 'deal_value', label: 'Deal value' },
  { value: 'callback', label: 'Next callback' },
  { value: 'name', label: 'Name' },
];

const leadPath = (id) => `/leads/${encodeURIComponent(id)}`;

/** API date (YYYY-MM-DD or ISO timestamp) → YYYY-MM-DD in India time. */
const toDateValue = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = parseAppDate(raw);
  if (!date) return '';
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const toMoney = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const dealValueValidator = validators.custom((value) => {
  if (isEmpty(value)) return '';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? '' : 'Enter a valid amount';
});

const toTagIds = (ids = []) => ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));

const todayStamp = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const emptyCreate = {
  name: '',
  phone: '',
  email: '',
  company: '',
  address: '',
  website: '',
  product_id: '',
  assigned_to: '',
  status: 'new',
  source: 'manual',
  deal_value: '',
  expected_close_date: '',
  tag_ids: [],
  notes: '',
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
  company: '',
  address: '',
  website: '',
  product_id: '',
  assigned_to: '',
  source: '',
  deal_value: '',
  expected_close_date: '',
  tag_ids: [],
  notes: '',
};

export default function Leads() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useAppSettings();
  const { tags } = useTags();
  const [extraFilters, setExtraFilters] = useState(() => readExtraFilters(searchParams));
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(() =>
    ['source', 'tag_id', 'temperature', 'callback', 'created_from', 'created_to', 'archived'].some(
      (key) => searchParams.get(key)
    )
  );
  const [usedSources, setUsedSources] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const productLabelRef = useRef({ id: '', label: '' });
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
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [createSaving, setCreateSaving] = useState(false);
  const [dupMatches, setDupMatches] = useState([]);
  const [dupConflict, setDupConflict] = useState(null);
  const [importAutoAssign, setImportAutoAssign] = useState(false);
  const [importSource, setImportSource] = useState('maps-import');
  const [importTagIds, setImportTagIds] = useState([]);
  const [createProductLabel, setCreateProductLabel] = useState('');
  const [createAssigneeLabel, setCreateAssigneeLabel] = useState('');
  const [importProductIds, setImportProductIds] = useState([]);
  const [importProductLabels, setImportProductLabels] = useState([]);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);

  const [selected, setSelected] = useState([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState(null);

  const [manageLead, setManageLead] = useState(null);
  const [manageMode, setManageMode] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'new', note: '', lost_reason: '' });
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
  const [bulkLostReason, setBulkLostReason] = useState('');
  const [bulkTagIds, setBulkTagIds] = useState([]);
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
    EXTRA_FILTER_KEYS.forEach((key) => {
      if (extraFilters[key]) params[key] = extraFilters[key];
    });
    return params;
  };

  const viewingArchived = extraFilters.archived === 'only';
  const activeExtraCount = ['source', 'tag_id', 'temperature', 'callback', 'created_from', 'created_to', 'archived'].filter(
    (key) => extraFilters[key]
  ).length;

  const setExtraFilter = (key, value) => {
    setPage(1);
    setExtraFilters((prev) => (prev[key] === (value || '') ? prev : { ...prev, [key]: value || '' }));
  };

  const clearExtraFilters = () => {
    setPage(1);
    setExtraFilters((prev) => ({
      ...Object.fromEntries(EXTRA_FILTER_KEYS.map((key) => [key, ''])),
      sort: prev.sort,
    }));
  };

  const loadStats = async (overrides = {}) => {
    try {
      const params = { ...buildParams(overrides) };
      delete params.page;
      delete params.limit;
      delete params.status;
      delete params.sort;
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
    const fromUrl = readExtraFilters(searchParams);
    setExtraFilters((prev) => (sameFilters(prev, fromUrl) ? prev : fromUrl));
    if (!fromProduct) {
      setProductFilterLabel('');
      return undefined;
    }
    if (productLabelRef.current.id === fromProduct && productLabelRef.current.label) {
      setProductFilterLabel(productLabelRef.current.label);
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

  // Mirror filters into the query string so filtered views can be linked/bookmarked.
  useEffect(() => {
    const current = searchParamsRef.current;
    const next = new URLSearchParams();
    current.forEach((value, key) => {
      if (!URL_FILTER_KEYS.includes(key)) next.append(key, value);
    });
    if (statusFilter) next.set('status', statusFilter);
    if (productFilter) next.set('product_id', productFilter);
    EXTRA_FILTER_KEYS.forEach((key) => {
      if (extraFilters[key]) next.set(key, extraFilters[key]);
    });
    if (canonicalQuery(next) !== canonicalQuery(current)) {
      setSearchParams(next, { replace: true });
    }
  }, [statusFilter, productFilter, extraFilters, setSearchParams]);

  // Reload when a filter changes (loadLeads reads the latest state from this render).
  useEffect(() => {
    loadLeads({ page: 1 });
  }, [productFilter, statusFilter, assignedFilter, extraFilters, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadLeads({ page: 1, search });
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api
      .get('/leads/sources')
      .then(({ data }) => setUsedSources(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const onDoc = (e) => {
      if (!exportRef.current?.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportOpen]);

  // Live duplicate check while creating a lead.
  useEffect(() => {
    if (!createOpen) return undefined;
    const phoneDigits = String(createForm.phone || '').replace(/\D/g, '');
    const email = String(createForm.email || '').trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (phoneDigits.length < 10 && !emailOk) {
      setDupMatches([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get('/leads/duplicates/check', {
          params: {
            phone: phoneDigits.length >= 10 ? createForm.phone : undefined,
            email: emailOk ? email : undefined,
          },
        })
        .then(({ data }) => {
          if (!cancelled) setDupMatches(data?.items || []);
        })
        .catch(() => {
          if (!cancelled) setDupMatches([]);
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [createOpen, createForm.phone, createForm.email]);

  // One lead per mobile number per product: a same-number, same-product match blocks creation.
  const sameProductDup = useMemo(() => {
    const pool = dupConflict || dupMatches;
    return (
      pool.find(
        (d) =>
          d.blocking ||
          (Number(d.phone_match) === 1 &&
            createForm.product_id &&
            String(d.product_id) === String(createForm.product_id))
      ) || null
    );
  }, [dupConflict, dupMatches, createForm.product_id]);

  const sourceOptions = useMemo(() => {
    const names = [...(settings.lead_sources || [])];
    usedSources.forEach((row) => {
      if (row?.name && !names.includes(row.name)) names.push(row.name);
    });
    return names.map((name) => ({ value: name, label: sourceLabel(name) }));
  }, [settings.lead_sources, usedSources]);

  const tagOptions = useMemo(
    () => tags.map((t) => ({ value: String(t.id), label: t.name })),
    [tags]
  );

  const lostReasonOptions = useMemo(
    () => (settings.lost_reasons || []).map((r) => ({ value: r, label: r })),
    [settings.lost_reasons]
  );

  const tagLabels = (ids = []) =>
    ids.map((id) => ({
      value: String(id),
      label: tags.find((t) => String(t.id) === String(id))?.name || String(id),
    }));

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
            value?.length ? '' : 'Please choose at least one Excel or CSV file'
          ),
        ],
      },
      { product_ids: importProductIds, file: files }
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    setImporting(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('product_ids', JSON.stringify(importProductIds));
      if (hasRole('admin')) {
        formData.append('auto_assign', importAutoAssign ? 'true' : 'false');
      }
      if (importSource) formData.append('source', importSource);
      if (importTagIds.length) {
        formData.append('tag_ids', JSON.stringify(toTagIds(importTagIds)));
      }
      const { data } = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const parts = [
        `Imported ${data.imported ?? 0}`,
        `Duplicates ignored ${data.duplicates ?? 0}`,
      ];
      if (data.phone_duplicates) parts.push(`Same number + product skipped ${data.phone_duplicates}`);
      parts.push(`Skipped ${data.skipped ?? 0}`);
      if (data.auto_assigned) parts.push(`Auto-assigned ${data.auto_assigned}`);
      if (data.links_backfilled) parts.push(`Google links added to ${data.links_backfilled} existing`);
      toast.success(parts.join(' · '), { duration: 6000 });
      setFiles([]);
      setImportProductIds([]);
      setImportProductLabels([]);
      setImportTagIds([]);
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
    if (mode === 'status') {
      setStatusForm({ status: lead.status || 'new', note: '', lost_reason: lead.lost_reason || '' });
    }
    if (mode === 'edit') {
      setEditForm({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        company: lead.company || '',
        address: lead.address || '',
        website: lead.website || '',
        product_id: lead.product_id != null ? String(lead.product_id) : '',
        assigned_to: lead.assigned_to != null ? String(lead.assigned_to) : '',
        source: lead.source || '',
        deal_value: lead.deal_value != null ? String(lead.deal_value) : '',
        expected_close_date: toDateValue(lead.expected_close_date),
        tag_ids: (lead.tags || []).map((t) => String(t.id)),
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
        lost_reason: [
          validators.custom((value, values) =>
            values.status === 'lost' && isEmpty(value) ? 'Select why this lead was lost' : ''
          ),
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
        ...(statusForm.status === 'lost' ? { lost_reason: statusForm.lost_reason } : {}),
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
        deal_value: [dealValueValidator],
      },
      editForm
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.put(`/leads/${manageLead.id}`, {
        ...editForm,
        assigned_to: hasRole('admin') ? editForm.assigned_to || null : undefined,
        source: editForm.source || undefined,
        deal_value: toMoney(editForm.deal_value),
        expected_close_date: editForm.expected_close_date || null,
        tag_ids: toTagIds(editForm.tag_ids),
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
        toast.success('Lead archived — restore it from Archived');
      } else if (confirmDelete.type === 'bulk') {
        const { data } = await api.post('/leads/bulk', {
          ids: confirmDelete.ids,
          action: 'archive',
        });
        toast.success(data.message || 'Bulk action completed');
        setSelected([]);
        setFabOpen(false);
      }
      setConfirmDelete(null);
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Archive failed');
    } finally {
      setDeleting(false);
    }
  };

  const restoreLead = async (lead) => {
    try {
      await api.post(`/leads/${lead.id}/restore`);
      toast.success(`"${lead.name}" restored`);
      loadLeads();
    } catch (err) {
      toast.error(apiError(err, 'Restore failed'));
    }
  };

  const exportLeads = async (format) => {
    setExportOpen(false);
    setExporting(true);
    try {
      const params = { ...buildParams(), format };
      delete params.page;
      delete params.limit;
      const { data } = await api.get('/leads/export', { params, responseType: 'blob' });
      downloadBlob(data, `leads-${todayStamp()}.${format === 'csv' ? 'csv' : 'xlsx'}`);
      toast.success('Export ready');
    } catch (err) {
      let message = 'Export failed';
      const blob = err?.response?.data;
      if (blob instanceof Blob) {
        try {
          message = JSON.parse(await blob.text())?.message || message;
        } catch {
          /* not JSON */
        }
      } else {
        message = apiError(err, message);
      }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const resetCreate = () => {
    setCreateForm(emptyCreate);
    setCreateProductLabel('');
    setCreateAssigneeLabel('');
    setDupMatches([]);
    setDupConflict(null);
    setFormErrors({});
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setDupConflict(null);
    setFormErrors({});
  };

  const submitCreate = async (force = false) => {
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
        deal_value: [dealValueValidator],
      },
      createForm
    );
    setFormErrors(result.errors);
    if (!result.valid) return;

    setCreateSaving(true);
    try {
      const { data } = await api.post('/leads', {
        ...createForm,
        product_id: createForm.product_id,
        assigned_to: hasRole('admin') ? createForm.assigned_to || null : undefined,
        source: createForm.source || 'manual',
        deal_value: toMoney(createForm.deal_value),
        expected_close_date: createForm.expected_close_date || null,
        tag_ids: toTagIds(createForm.tag_ids),
        ...(force ? { force: true } : {}),
      });
      const newId = data?.id;
      toast.success(
        (t) => (
          <span className="lu-toast">
            Lead created
            {newId ? (
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate(leadPath(newId));
                }}
              >
                Open
              </button>
            ) : null}
          </span>
        ),
        { duration: 6000 }
      );
      setCreateOpen(false);
      setDupConflict(null);
      loadLeads({ page: 1 });
    } catch (err) {
      const body = err.response?.data;
      if (err.response?.status === 409 && body?.code === 'DUPLICATE_PHONE_PRODUCT') {
        setDupConflict([{ ...body.existing, blocking: true }]);
        toast.error(body.message || 'This mobile number already has a lead for this product');
      } else if (err.response?.status === 409 && body?.code === 'DUPLICATE_LEAD') {
        setDupConflict(body.duplicates || []);
        toast.error(body.message || 'A lead with this phone or email already exists');
      } else {
        toast.error(apiError(err, 'Failed to create lead'));
      }
    } finally {
      setCreateSaving(false);
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
      setBulkLostReason('');
      setBulkTagIds([]);
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
    {
      label: 'Hot leads',
      value: stats?.hot_count || 0,
      icon: FiThermometer,
      tone: 'rose',
      active: extraFilters.temperature === 'hot',
      onClick: () => setExtraFilter('temperature', extraFilters.temperature === 'hot' ? '' : 'hot'),
      title: 'Show hot leads',
    },
    {
      label: 'Pipeline value',
      value: formatCurrency(stats?.open_value || 0, { compact: true }),
      icon: FiTrendingUp,
      tone: 'blue',
      title: 'Total deal value of open leads',
    },
    {
      label: 'Overdue follow-ups',
      value: stats?.overdue_callbacks || 0,
      icon: FiClock,
      tone: Number(stats?.overdue_callbacks) > 0 ? 'rose' : 'cyan',
      active: extraFilters.callback === 'overdue',
      onClick: () => setExtraFilter('callback', extraFilters.callback === 'overdue' ? '' : 'overdue'),
      title: 'Show leads with overdue callbacks',
    },
    ...(hasRole('admin')
      ? [{ label: 'Unassigned', value: stats?.unassigned_count || 0, icon: FiUserCheck, tone: 'cyan' }]
      : []),
  ];

  const tableCols = hasRole('admin') ? 9 : 8;

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
          <div className="lu-export" ref={exportRef}>
            <button
              type="button"
              className="btn"
              disabled={exporting}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((v) => !v)}
            >
              <FiDownload size={15} />
              {exporting ? 'Exporting…' : 'Export'}
              <FiChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="lu-export-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => exportLeads('xlsx')}>
                  Excel (.xlsx)
                </button>
                <button type="button" role="menuitem" onClick={() => exportLeads('csv')}>
                  CSV (.csv)
                </button>
                <small>Uses the current filters and sort</small>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              resetCreate();
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

      <section className={`stat-grid stat-grid-compact lu-stat-grid ${statCards.length > 8 ? 'lu-stat-grid-9' : ''}`}>
        {statCards.map((card) => {
          const Icon = card.icon;
          const body = (
            <>
              <span className="stat-icon">
                <Icon size={13} />
              </span>
              <div className="stat-card-body">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            </>
          );
          return card.onClick ? (
            <button
              key={card.label}
              type="button"
              title={card.title}
              aria-pressed={!!card.active}
              onClick={card.onClick}
              className={`stat-card stat-card-sm stat-tone-${card.tone} lu-stat-btn ${card.active ? 'is-active' : ''}`}
            >
              {body}
            </button>
          ) : (
            <article
              key={card.label}
              title={card.title}
              className={`stat-card stat-card-sm stat-tone-${card.tone}`}
            >
              {body}
            </article>
          );
        })}
      </section>

      <section className="panel leads-panel">
        <div className="leads-toolbar">
          <div className="leads-toolbar-title lu-toolbar-title">
            <h2>{viewingArchived ? 'Archived leads' : 'All leads'}</h2>
            <span className="count-chip">{total} total</span>
            <div className="lu-toolbar-tools">
              <label className="lu-sort">
                <span>Sort</span>
                <SearchableSelect
                  value={extraFilters.sort || 'updated'}
                  options={sortOptions}
                  clearable={false}
                  onChange={(val) => setExtraFilter('sort', val && val !== 'updated' ? val : '')}
                />
              </label>
              <button
                type="button"
                className={`btn small lu-more-btn ${moreFiltersOpen ? 'active' : ''}`}
                aria-expanded={moreFiltersOpen}
                onClick={() => setMoreFiltersOpen((v) => !v)}
              >
                <FiFilter size={13} />
                More filters
                {activeExtraCount > 0 ? <span className="lu-filter-count">{activeExtraCount}</span> : null}
              </button>
            </div>
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
                productLabelRef.current = { id: String(val || ''), label: opt?.label || '' };
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

          {moreFiltersOpen && (
            <div className="lu-more-filters">
              <SearchableSelect
                value={extraFilters.source}
                placeholder="Any source"
                clearable
                options={sourceOptions}
                onChange={(val) => setExtraFilter('source', val)}
              />
              <SearchableSelect
                value={extraFilters.tag_id}
                placeholder="Any tag"
                clearable
                options={tagOptions}
                onChange={(val) => setExtraFilter('tag_id', val)}
              />
              <SearchableSelect
                value={extraFilters.temperature}
                placeholder="Any temperature"
                clearable
                options={temperatureOptions}
                onChange={(val) => setExtraFilter('temperature', val)}
              />
              <SearchableSelect
                value={extraFilters.callback}
                placeholder="Any callback"
                clearable
                options={callbackOptions}
                onChange={(val) => setExtraFilter('callback', val)}
              />
              <DateTimePicker
                mode="date"
                value={extraFilters.created_from}
                placeholder="Created from"
                onChange={(val) => setExtraFilter('created_from', val)}
              />
              <DateTimePicker
                mode="date"
                value={extraFilters.created_to}
                placeholder="Created to"
                onChange={(val) => setExtraFilter('created_to', val)}
              />
              <div className="lu-more-filters-end">
                {hasRole('admin') && (
                  <Switch
                    checked={viewingArchived}
                    onChange={(on) => setExtraFilter('archived', on ? 'only' : '')}
                    label="Archived"
                  />
                )}
                {activeExtraCount > 0 && (
                  <button type="button" className="btn small ghost" onClick={clearExtraFilters}>
                    <FiX size={13} />
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
          {viewingArchived && (
            <p className="lu-archived-note">
              <FiArchive size={13} />
              Showing archived leads. Select leads and use Restore to bring them back.
            </p>
          )}
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
                  <td colSpan={tableCols}>
                    {viewingArchived
                      ? 'No archived leads match these filters.'
                      : activeExtraCount > 0 || search || statusFilter || productFilter || assignedFilter
                        ? 'No leads match these filters.'
                        : 'No leads found. Import an Excel or CSV file to begin.'}
                  </td>
                </tr>
              )}
              {leads.map((lead) => {
                const callback = formatCallback(lead.next_callback);
                return (
                <tr
                  key={lead.id}
                  className={`${selected.includes(lead.id) ? 'row-selected' : ''} ${
                    lead.archived_at ? 'lu-row-archived' : ''
                  }`.trim()}
                >
                  <td className="check-col">
                    <Checkbox
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      ariaLabel={`Select ${lead.name}`}
                    />
                  </td>
                  <td className="col-name">
                    <strong>
                      <Link
                        to={leadPath(lead.id)}
                        className="lu-lead-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.name}
                      </Link>
                    </strong>
                    {lead.tags?.length ? (
                      <div className="lu-row-tags">
                        <TagList tags={lead.tags} max={2} />
                      </div>
                    ) : null}
                    {lead.address ? (
                      <div>
                        <small>{lead.address}</small>
                      </div>
                    ) : null}
                  </td>
                  <td className="col-product">
                    <div className="lu-ellipsis">{lead.product_name || '—'}</div>
                    {lead.deal_value != null && lead.deal_value !== '' ? (
                      <small className="lu-deal" title={formatCurrency(lead.deal_value)}>
                        {formatCurrency(lead.deal_value, { compact: true })}
                      </small>
                    ) : null}
                  </td>
                  <td className="col-contact">
                    <div>{lead.phone || '—'}</div>
                    {lead.email ? <small>{lead.email}</small> : null}
                    <ContactLinks
                      className="lu-contact-links"
                      phone={lead.phone}
                      name={lead.name}
                      map={mapsLink(lead)}
                      whatsapp={false}
                    />
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
                    {lead.temperature ? (
                      <div className="lu-temp">
                        <TemperatureBadge temperature={lead.temperature} score={lead.score} />
                      </div>
                    ) : null}
                    {lead.archived_at ? (
                      <div className="lu-temp">
                        <span className="tag-chip tone-slate">Archived</span>
                      </div>
                    ) : null}
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
                          label: 'Open details',
                          icon: <FiExternalLink size={14} />,
                          onClick: () => navigate(leadPath(lead.id)),
                        },
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
                              lead.archived_at
                                ? {
                                    label: 'Restore',
                                    icon: <FiRotateCcw size={14} />,
                                    onClick: () => restoreLead(lead),
                                  }
                                : {
                                    label: 'Archive',
                                    icon: <FiArchive size={14} />,
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
                  {hasRole('admin') && viewingArchived && (
                    <button type="button" onClick={() => runBulk('restore')}>
                      <FiRotateCcw size={14} /> Restore
                    </button>
                  )}
                  {hasRole('admin') && (
                    <button type="button" onClick={() => setBulkModal('assign')}>
                      <FiUserCheck size={14} /> Assign
                    </button>
                  )}
                  {hasRole('admin') && (
                    <button type="button" onClick={() => runBulk('auto_assign')}>
                      <FiShuffle size={14} /> Auto-assign (round-robin)
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
                  <button
                    type="button"
                    onClick={() => {
                      setBulkTagIds([]);
                      setFormErrors({});
                      setBulkModal('tag_add');
                    }}
                  >
                    <FiTag size={14} /> Add tags
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkTagIds([]);
                      setFormErrors({});
                      setBulkModal('tag_remove');
                    }}
                  >
                    <FiTag size={14} /> Remove tags
                  </button>
                  {hasRole('admin') && !viewingArchived && (
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
                      <FiArchive size={14} /> Archive
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
        onClose={closeCreate}
        footer={
          <>
            <button type="button" className="btn" onClick={closeCreate}>
              Cancel
            </button>
            {sameProductDup ? (
              <button type="button" className="btn primary" disabled title="This number already has a lead for this product">
                Can’t create: duplicate
              </button>
            ) : dupConflict ? (
              <button
                type="button"
                className="btn primary"
                disabled={createSaving}
                onClick={() => submitCreate(true)}
              >
                {createSaving ? 'Creating…' : 'Create anyway'}
              </button>
            ) : (
              <button
                type="submit"
                form="create-lead-form"
                className="btn primary"
                disabled={createSaving}
              >
                {createSaving ? 'Creating…' : 'Create lead'}
              </button>
            )}
          </>
        }
      >
        <form
          id="create-lead-form"
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate(false);
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
                setDupConflict(null);
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
                setDupConflict(null);
                setFormErrors((prev) => clearFieldError(prev, 'email'));
              }}
              placeholder="Email"
              className={formErrors.email ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Company">
            <input
              value={createForm.company}
              onChange={(e) => setCreateForm((p) => ({ ...p, company: e.target.value }))}
              placeholder="Company / business name"
            />
          </FormField>
          {(dupConflict || dupMatches).length > 0 && (
            <div className={`lu-dup full ${dupConflict || sameProductDup ? 'is-blocking' : ''}`} role="alert">
              <div className="lu-dup-head">
                <FiAlertCircle size={15} />
                <strong>
                  {sameProductDup
                    ? `This mobile number already has a lead for ${sameProductDup.product_name || 'this product'}`
                    : dupConflict
                      ? 'A lead with this phone or email already exists'
                      : `Possible duplicate${(dupMatches.length > 1) ? 's' : ''} found`}
                </strong>
              </div>
              <ul>
                {(dupConflict || dupMatches).map((d, i) => (
                  <li key={d.id || `${d.name}-${i}`}>
                    {d.id && !d.restricted ? (
                      <Link to={leadPath(d.id)} target="_blank" rel="noreferrer">
                        {d.name}
                      </Link>
                    ) : (
                      <span>{d.name}</span>
                    )}
                    <small>
                      {[
                        d.status ? formatOptionLabel(d.status) : null,
                        d.product_name,
                        d.phone,
                        d.email,
                        d.assigned_name
                          ? `assigned to ${d.assigned_name}`
                          : d.restricted
                            ? null
                            : 'unassigned',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </li>
                ))}
              </ul>
              {sameProductDup ? (
                <p>One mobile number can have only one lead per product. Open the existing lead instead, or choose a different product.</p>
              ) : dupConflict ? (
                <p>Use “Create anyway” to add it as a separate lead.</p>
              ) : null}
            </div>
          )}
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
                setDupConflict(null);
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
          <FormField label="Source">
            <SearchableSelect
              value={createForm.source}
              options={sourceOptions}
              clearable={false}
              onChange={(val) => setCreateForm((p) => ({ ...p, source: val || 'manual' }))}
            />
          </FormField>
          <FormField label="Deal value (₹)" error={formErrors.deal_value}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={createForm.deal_value}
              onChange={(e) => {
                setCreateForm((p) => ({ ...p, deal_value: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'deal_value'));
              }}
              placeholder="Optional"
              className={formErrors.deal_value ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Expected close date">
            <DateTimePicker
              mode="date"
              value={createForm.expected_close_date}
              onChange={(val) => setCreateForm((p) => ({ ...p, expected_close_date: val || '' }))}
            />
          </FormField>
          <FormField label="Tags">
            <SearchableSelect
              multiple
              value={createForm.tag_ids}
              valueLabels={tagLabels(createForm.tag_ids)}
              placeholder={tagOptions.length ? 'Select tags' : 'No tags yet'}
              options={tagOptions}
              onChange={(vals) => setCreateForm((p) => ({ ...p, tag_ids: vals || [] }))}
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
              {importing ? 'Importing...' : files.length > 1 ? `Import ${files.length} files` : 'Import file'}
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
          <FormField label="Import files *" className="full" error={formErrors.file}>
            <label
              className={`file-dropzone ${files.length ? 'has-file' : ''} ${
                formErrors.file ? 'invalid' : ''
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                multiple
                className="file-dropzone-input"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files || []));
                  setFormErrors((prev) => clearFieldError(prev, 'file'));
                }}
              />
              <span className="file-dropzone-icon" aria-hidden>
                {files.length ? <FiCheck size={22} /> : <FiUpload size={22} />}
              </span>
              <span className="file-dropzone-copy">
                {files.length ? (
                  <>
                    <strong title={files.map((f) => f.name).join(', ')}>
                      {files.length === 1 ? files[0].name : `${files.length} files selected`}
                    </strong>
                    <small>
                      {(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB · Click to replace
                    </small>
                    {files.length > 1 && (
                      <small className="file-dropzone-names">
                        {files.map((f) => f.name).join(', ')}
                      </small>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Drop files here or browse</strong>
                    <small>
                      <FiFile size={12} /> .xlsx, .xls, or .csv · select multiple files
                    </small>
                  </>
                )}
              </span>
            </label>
          </FormField>
          <FormField label="Source">
            <SearchableSelect
              value={importSource}
              options={sourceOptions}
              clearable={false}
              onChange={(val) => setImportSource(val || 'maps-import')}
            />
          </FormField>
          <FormField label="Tags">
            <SearchableSelect
              multiple
              value={importTagIds}
              valueLabels={tagLabels(importTagIds)}
              placeholder={tagOptions.length ? 'Tag imported leads' : 'No tags yet'}
              options={tagOptions}
              onChange={(vals) => setImportTagIds(vals || [])}
            />
          </FormField>
          <div className="full lu-import-switches">
            {hasRole('admin') && (
              <Switch
                checked={importAutoAssign}
                onChange={setImportAutoAssign}
                label="Auto-assign imported leads (round-robin)"
              />
            )}
          </div>
          <p className="hint full">
            Selecting multiple products imports the same sheet for each product. A mobile number that
            already has a lead for a product is always skipped for that product.
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
            {manageLead ? (
              <Link className="btn" to={leadPath(manageLead.id)}>
                <FiExternalLink size={14} />
                Open full page
              </Link>
            ) : null}
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
              [
                'Google Business Profile',
                /^https?:\/\//i.test(manageLead.business_profile_url || '') ? (
                  <a href={manageLead.business_profile_url} target="_blank" rel="noopener noreferrer">
                    Open in Google Maps
                  </a>
                ) : (
                  '—'
                ),
              ],
              ['Category', manageLead.category || '—'],
              ['Address', manageLead.address || '—'],
              ['Source', sourceLabel(manageLead.source)],
              ['Company', manageLead.company || '—'],
              [
                'Deal value',
                manageLead.deal_value != null ? formatCurrency(manageLead.deal_value) : '—',
              ],
              [
                'Expected close',
                manageLead.expected_close_date
                  ? formatDateTime(toDateValue(manageLead.expected_close_date), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—',
              ],
              ['Lead score', manageLead.score != null ? `${manageLead.score}/100` : '—'],
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
            {manageLead.tags?.length ? (
              <div className="detail-item">
                <span>Tags</span>
                <strong>
                  <TagList tags={manageLead.tags} max={6} />
                </strong>
              </div>
            ) : null}
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
          {statusForm.status === 'lost' && (
            <FormField label="Lost reason *" className="full" error={formErrors.lost_reason}>
              <SearchableSelect
                value={statusForm.lost_reason}
                placeholder="Why was this lead lost?"
                options={lostReasonOptions}
                invalid={Boolean(formErrors.lost_reason)}
                onChange={(val) => {
                  setStatusForm((prev) => ({ ...prev, lost_reason: val || '' }));
                  setFormErrors((prev) => clearFieldError(prev, 'lost_reason'));
                }}
              />
            </FormField>
          )}
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
          <FormField label="Product">
            <div className="field-readonly" title="A lead's product can't be changed after it is created">
              <FiBox size={14} aria-hidden="true" />
              {editProductLabel || manageLead?.product_name || '—'}
              <small>Locked</small>
            </div>
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
          <FormField label="Company">
            <input
              value={editForm.company}
              onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
              placeholder="Company / business name"
            />
          </FormField>
          <FormField label="Source">
            <SearchableSelect
              value={editForm.source}
              placeholder="Select source"
              options={
                editForm.source && !sourceOptions.some((o) => o.value === editForm.source)
                  ? [...sourceOptions, { value: editForm.source, label: sourceLabel(editForm.source) }]
                  : sourceOptions
              }
              clearable={false}
              onChange={(val) => setEditForm((p) => ({ ...p, source: val || p.source }))}
            />
          </FormField>
          <FormField label="Deal value (₹)" error={formErrors.deal_value}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={editForm.deal_value}
              onChange={(e) => {
                setEditForm((p) => ({ ...p, deal_value: e.target.value }));
                setFormErrors((prev) => clearFieldError(prev, 'deal_value'));
              }}
              placeholder="Optional"
              className={formErrors.deal_value ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Expected close date">
            <DateTimePicker
              mode="date"
              value={editForm.expected_close_date}
              onChange={(val) => setEditForm((p) => ({ ...p, expected_close_date: val || '' }))}
            />
          </FormField>
          <FormField label="Tags" className="full">
            <SearchableSelect
              multiple
              value={editForm.tag_ids}
              valueLabels={tagLabels(editForm.tag_ids)}
              placeholder={tagOptions.length ? 'Select tags' : 'No tags yet'}
              options={tagOptions}
              onChange={(vals) => setEditForm((p) => ({ ...p, tag_ids: vals || [] }))}
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
          <FormField label="Product">
            <div className="field-readonly" title="A callback is always for the lead's product">
              <FiBox size={14} aria-hidden="true" />
              {reminderProductLabel || manageLead?.product_name || '—'}
              <small>From the lead</small>
            </div>
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
                    lost_reason: [
                      validators.custom((value, values) =>
                        values.status === 'lost' && isEmpty(value)
                          ? 'Select why these leads were lost'
                          : ''
                      ),
                    ],
                  },
                  { status: bulkStatus, lost_reason: bulkLostReason }
                );
                setFormErrors(result.errors);
                if (!result.valid) return;
                runBulk('status', {
                  status: bulkStatus,
                  note: bulkStatusNote || null,
                  ...(bulkStatus === 'lost' ? { lost_reason: bulkLostReason } : {}),
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
        {bulkStatus === 'lost' && (
          <FormField label="Lost reason *" error={formErrors.lost_reason}>
            <SearchableSelect
              value={bulkLostReason}
              placeholder="Why were these leads lost?"
              options={lostReasonOptions}
              invalid={Boolean(formErrors.lost_reason)}
              onChange={(val) => {
                setBulkLostReason(val || '');
                setFormErrors((prev) => clearFieldError(prev, 'lost_reason'));
              }}
            />
          </FormField>
        )}
        <FormField label="Note (optional)" className="full">
          <textarea
            rows="3"
            value={bulkStatusNote}
            onChange={(e) => setBulkStatusNote(e.target.value)}
            placeholder="Optional note for this status change"
          />
        </FormField>
      </Modal>

      <Modal
        open={bulkModal === 'tag_add' || bulkModal === 'tag_remove'}
        title={`${bulkModal === 'tag_remove' ? 'Remove tags from' : 'Add tags to'} ${selected.length} lead(s)`}
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
                if (!bulkTagIds.length) {
                  setFormErrors({ tag_ids: 'Select at least one tag' });
                  return;
                }
                runBulk(bulkModal, { tag_ids: toTagIds(bulkTagIds) });
              }}
            >
              {bulkModal === 'tag_remove' ? 'Remove tags' : 'Add tags'}
            </button>
          </>
        }
      >
        <FormField
          label="Tags"
          error={formErrors.tag_ids}
          hint={tagOptions.length ? undefined : 'No tags yet — create tags in Settings first.'}
        >
          <SearchableSelect
            multiple
            value={bulkTagIds}
            valueLabels={tagLabels(bulkTagIds)}
            placeholder="Select tags"
            options={tagOptions}
            invalid={Boolean(formErrors.tag_ids)}
            onChange={(vals) => {
              setBulkTagIds(vals || []);
              setFormErrors((prev) => clearFieldError(prev, 'tag_ids'));
            }}
          />
        </FormField>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title={
          confirmDelete?.type === 'bulk'
            ? `Archive ${confirmDelete.ids?.length || 0} lead(s)?`
            : 'Archive lead?'
        }
        message={
          confirmDelete?.type === 'bulk'
            ? 'Archived leads are hidden from lists and reports. You can restore them from Archived.'
            : `Archive "${confirmDelete?.name || 'this lead'}"? You can restore it from Archived.`
        }
        confirmLabel="Archive"
        loading={deleting}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
      />
    </div>
  );
}
