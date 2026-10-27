import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowRight, FiChevronRight, FiFileText, FiFilter, FiSearch, FiX } from 'react-icons/fi';
import api from '../api/client';
import Pagination from '../components/Pagination';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { SkeletonTable } from '../components/Skeleton';
import { EmptyState } from '../components/crm/Badges';
import { loadAdminUsersOptions } from '../utils/apiSelect';
import { apiError, formatRelative, stageLabel, STAGES } from '../utils/crm';
import { formatDateTime, formatOptionLabel } from '../utils/format';
import '../styles/audit-log.css';

const ENTITY_OPTIONS = ['lead', 'tag', 'product', 'user', 'settings'].map((v) => ({ value: v, label: formatOptionLabel(v) }));

const ACTION_TONES = {
  create: 'emerald',
  update: 'blue',
  assign: 'indigo',
  status: 'amber',
  archive: 'orange',
  restore: 'teal',
  merge: 'violet',
  import: 'sky',
  export: 'cyan',
  delete: 'rose',
  deactivate: 'slate',
};

const ACTION_OPTIONS = Object.keys(ACTION_TONES).map((v) => ({ value: v, label: formatOptionLabel(v) }));

const STAGE_KEYS = new Set(STAGES.map((s) => s.key));

function isEmpty(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function formatValue(field, value) {
  if (isEmpty(value)) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.map((v) => (v !== null && typeof v === 'object' ? v.name ?? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if ((field === 'status' || field.endsWith('_status')) && STAGE_KEYS.has(value)) return stageLabel(value);
  if ((field.endsWith('_enabled') || field === 'whatsapp_active' || field === 'auto_assign') && (value === 0 || value === 1)) {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

function DiffValue({ field, value }) {
  const text = formatValue(field, value);
  if (text === null) return <em className="al-empty">empty</em>;
  return <span className="al-value">{text}</span>;
}

function ChangesTable({ changes }) {
  const entries = Object.entries(changes || {});
  return (
    <div className="al-diff">
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Before</th>
            <th aria-hidden="true" />
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, pair]) => {
            const [before, after] = Array.isArray(pair) && pair.length === 2 ? pair : [undefined, pair];
            return (
              <tr key={field}>
                <td className="al-diff-field">{formatOptionLabel(field)}</td>
                <td className="al-diff-before">
                  <DiffValue field={field} value={before} />
                </td>
                <td className="al-diff-arrow" aria-hidden="true">
                  <FiArrowRight size={13} />
                </td>
                <td className="al-diff-after">
                  <DiffValue field={field} value={after} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EntityCell({ row }) {
  const type = row.entity_type;
  const label = formatOptionLabel(type) || '—';
  if (type === 'lead' && row.entity_id) {
    return (
      <span className="al-entity">
        <span className="al-entity-type">{label}</span>
        <Link to={`/leads/${encodeURIComponent(row.entity_id)}`} className="al-entity-link" title={String(row.entity_id)} onClick={(e) => e.stopPropagation()}>
          Open lead
        </Link>
      </span>
    );
  }
  return (
    <span className="al-entity">
      <span className="al-entity-type">{label}</span>
      {row.entity_id ? <small title={String(row.entity_id)}>#{row.entity_id}</small> : null}
    </span>
  );
}

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [userLabel, setUserLabel] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change returns to page 1.
  useEffect(() => {
    setPage(1);
  }, [search, entityType, action, userId, from, to]);

  const rangeInvalid = Boolean(from && to && from > to);

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const { data } = await api.get('/audit', {
        params: {
          page,
          limit,
          search: search || undefined,
          entity_type: entityType || undefined,
          action: action || undefined,
          user_id: userId || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      if (id !== reqId.current) return;
      setItems(data.items || []);
      setTotal(Number(data.total) || 0);
      setTotalPages(Number(data.totalPages) || 1);
      setExpanded(new Set());
    } catch (err) {
      if (id === reqId.current) toast.error(apiError(err, 'Failed to load audit log'));
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [page, limit, search, entityType, action, userId, from, to, rangeInvalid]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = Boolean(search || entityType || action || userId || from || to);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setEntityType('');
    setAction('');
    setUserId('');
    setUserLabel('');
    setFrom('');
    setTo('');
  };

  const toggle = (rowId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  return (
    <div className="page al-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Administration</span>
          <h1>Audit log</h1>
          <p>Every change made in the workspace — who did it, when, and what changed.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton onRefresh={load} />
        </div>
      </header>

      <section className="panel leads-panel">
        <div className="leads-toolbar">
          <div className="leads-toolbar-title">
            <h2>Activity</h2>
            <span className="count-chip">{total.toLocaleString('en-IN')} entries</span>
            {hasFilters ? (
              <button type="button" className="btn small ghost al-clear" onClick={clearFilters}>
                <FiX size={13} /> Clear filters
              </button>
            ) : null}
          </div>
          <div className="al-filters">
            <label className="filter-search al-search">
              <FiSearch size={15} />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search summaries…"
                aria-label="Search audit log"
              />
            </label>
            <SearchableSelect value={entityType} options={ENTITY_OPTIONS} placeholder="All entities" onChange={(v) => setEntityType(v || '')} />
            <SearchableSelect value={action} options={ACTION_OPTIONS} placeholder="All actions" onChange={(v) => setAction(v || '')} />
            <SearchableSelect
              value={userId}
              valueLabel={userLabel}
              loadOptions={loadAdminUsersOptions}
              placeholder="All users"
              onChange={(v, opt) => {
                setUserId(v || '');
                setUserLabel(opt?.label || '');
              }}
            />
            <label className="al-date">
              <span>From</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={rangeInvalid ? 'invalid' : ''} />
            </label>
            <label className="al-date">
              <span>To</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={rangeInvalid ? 'invalid' : ''} />
            </label>
          </div>
          {rangeInvalid ? <p className="al-range-error">“From” must be on or before “To”.</p> : null}
        </div>

        {!loaded ? (
          <SkeletonTable rows={8} cols={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={hasFilters ? FiFilter : FiFileText}
            title={hasFilters ? 'No entries match these filters' : 'No audit entries yet'}
            action={
              hasFilters ? (
                <button type="button" className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null
            }
          >
            {hasFilters
              ? 'Try widening the date range or removing a filter.'
              : 'Changes to leads, tags, products, users and settings will appear here.'}
          </EmptyState>
        ) : (
          <div className={`table-wrap al-table ${loading ? 'al-loading' : ''}`} aria-busy={loading}>
            <table>
              <thead>
                <tr>
                  <th className="al-col-toggle" aria-label="Expand" />
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const changeCount = row.changes && typeof row.changes === 'object' ? Object.keys(row.changes).length : 0;
                  const canExpand = changeCount > 0;
                  const open = expanded.has(row.id);
                  const tone = ACTION_TONES[row.action] || 'slate';
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`${canExpand ? 'al-row-expandable' : ''} ${open ? 'al-row-open' : ''}`}
                        onClick={canExpand ? () => toggle(row.id) : undefined}
                      >
                        <td className="al-col-toggle">
                          {canExpand ? (
                            <button
                              type="button"
                              className={`al-toggle ${open ? 'open' : ''}`}
                              aria-expanded={open}
                              aria-label={open ? 'Hide changes' : 'Show changes'}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(row.id);
                              }}
                            >
                              <FiChevronRight size={15} />
                            </button>
                          ) : null}
                        </td>
                        <td className="al-col-time">
                          <span>{formatRelative(row.created_at)}</span>
                          <small>{formatDateTime(row.created_at)}</small>
                        </td>
                        <td className="al-col-user">
                          {row.user_name ? <strong>{row.user_name}</strong> : <span className="crm-muted">System</span>}
                          {row.ip_address ? <small>{row.ip_address}</small> : null}
                        </td>
                        <td>
                          <span className={`al-action tone-${tone}`}>{formatOptionLabel(row.action)}</span>
                        </td>
                        <td>
                          <EntityCell row={row} />
                        </td>
                        <td className="al-col-summary">
                          <span>{row.summary || '—'}</span>
                          {canExpand && !open ? (
                            <small className="al-change-hint">
                              {changeCount} field{changeCount === 1 ? '' : 's'} changed
                            </small>
                          ) : null}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="al-detail-row">
                          <td colSpan={6}>
                            <ChangesTable changes={row.changes} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {loaded && items.length > 0 ? (
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
        ) : null}
      </section>
    </div>
  );
}
