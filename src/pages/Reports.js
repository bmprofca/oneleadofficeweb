import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiAlertCircle,
  FiAward,
  FiBarChart2,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiDownload,
  FiPercent,
  FiTrendingUp,
  FiUserPlus,
} from 'react-icons/fi';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/crm/Badges';
import { AXIS_TICK, LEGEND_PROPS, TOOLTIP_PROPS } from '../components/reports/chartTheme';
import useAppSettings from '../hooks/useAppSettings';
import { loadAllProductsOptions, loadUsersOptions } from '../utils/apiSelect';
import {
  activityLabel,
  apiError,
  downloadBlob,
  formatCurrency,
  formatNumber,
  sourceLabel,
  STAGE_HEX,
  stageLabel,
  TONE_HEX,
} from '../utils/crm';
import { formatDateTime } from '../utils/format';
import '../styles/reports.css';

const PRESETS = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'year', label: 'This year' },
];

const PALETTE = [
  TONE_HEX.indigo,
  TONE_HEX.sky,
  TONE_HEX.teal,
  TONE_HEX.amber,
  TONE_HEX.violet,
  TONE_HEX.pink,
  TONE_HEX.emerald,
  TONE_HEX.orange,
  TONE_HEX.lime,
  TONE_HEX.slate,
];

const ACTIVITY_HEX = {
  call: TONE_HEX.indigo,
  whatsapp: TONE_HEX.emerald,
  email: TONE_HEX.sky,
  meeting: TONE_HEX.amber,
  message: TONE_HEX.violet,
  note: TONE_HEX.slate,
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function presetRange(key) {
  const today = new Date();
  const back = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d;
  };
  switch (key) {
    case '7d':
      return { from: ymd(back(6)), to: ymd(today) };
    case '90d':
      return { from: ymd(back(89)), to: ymd(today) };
    case 'month':
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
    case 'last_month':
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'year':
      return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: ymd(today) };
    case '30d':
    default:
      return { from: ymd(back(29)), to: ymd(today) };
  }
}

const dash = (value, suffix = '') =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}${suffix}`;

const shortDate = (value) => formatDateTime(value, { day: 'numeric', month: 'short' });

/** Axios blob errors carry JSON in a Blob — read it back into a message. */
async function blobError(err, fallback) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.message) return parsed.message;
    } catch {
      /* not JSON */
    }
  }
  return apiError(err, fallback);
}

function Kpi({ label, value, sub, icon: Icon, tone, highlight }) {
  return (
    <article className={`stat-card stat-card-kpi rp-kpi stat-tone-${tone} ${highlight ? 'rp-kpi-alert' : ''}`}>
      <div className="stat-card-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className="rp-kpi-body">
        <strong>{value}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>
    </article>
  );
}

function ChartPanel({ title, subtitle, wide, children, empty, emptyText = 'No data in this range.' }) {
  return (
    <article className={`panel chart-panel rp-chart ${wide ? 'chart-panel-wide' : ''}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {empty ? <p className="chart-empty rp-chart-empty">{emptyText}</p> : children}
    </article>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <section className="rp-kpis">
        {Array.from({ length: 7 }).map((_, i) => (
          <article key={i} className="stat-card rp-kpi">
            <Skeleton width="55%" height={12} />
            <Skeleton width="40%" height={26} />
            <Skeleton width="65%" height={10} />
          </article>
        ))}
      </section>
      <section className="rp-grid">
        {[0, 1, 2, 3].map((i) => (
          <article key={i} className={`panel chart-panel ${i === 0 ? 'chart-panel-wide' : ''}`}>
            <div className="panel-header">
              <Skeleton width={160} height={16} />
            </div>
            <Skeleton height={240} radius={12} className="full-skel" />
          </article>
        ))}
      </section>
    </>
  );
}

const TEAM_COLUMNS = [
  { key: 'name', label: 'Name', numeric: false },
  { key: 'open_leads', label: 'Open' },
  { key: 'open_value', label: 'Open value', money: true },
  { key: 'new_leads', label: 'New' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'win_rate', label: 'Win rate', pct: true },
  { key: 'won_value', label: 'Won value', money: true },
  { key: 'activities', label: 'Activities' },
  { key: 'calls', label: 'Calls' },
  { key: 'followups_done', label: 'Follow-ups done' },
  { key: 'overdue', label: 'Overdue' },
];

function TeamTable({ team, currency }) {
  const [sort, setSort] = useState({ key: 'won_value', dir: 'desc' });

  const rows = useMemo(() => {
    const list = [...team];
    const { key, dir } = sort;
    list.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (key === 'name') {
        return dir === 'asc'
          ? String(av || '').localeCompare(String(bv || ''))
          : String(bv || '').localeCompare(String(av || ''));
      }
      // nulls always last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return list;
  }, [team, sort]);

  const toggle = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );

  return (
    <div className="table-wrap rp-team-table">
      <table>
        <thead>
          <tr>
            {TEAM_COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  className={col.numeric === false ? '' : 'rp-num'}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className={`rp-sort ${active ? 'active' : ''}`} onClick={() => toggle(col.key)}>
                    {col.label}
                    {active ? (
                      sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />
                    ) : (
                      <FiChevronDown size={12} className="rp-sort-idle" />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {TEAM_COLUMNS.map((col) => {
                const v = row[col.key];
                if (col.key === 'name') {
                  return (
                    <td key={col.key}>
                      <strong>{row.name}</strong>
                      {row.status && row.status !== 'active' ? <small className="rp-inactive">Inactive</small> : null}
                    </td>
                  );
                }
                if (col.key === 'overdue') {
                  return (
                    <td key={col.key} className="rp-num">
                      {Number(v) > 0 ? <span className="rp-overdue">{formatNumber(v)}</span> : <span className="crm-muted">0</span>}
                    </td>
                  );
                }
                let text;
                if (col.money) text = formatCurrency(v || 0, { currency });
                else if (col.pct) text = dash(v, '%');
                else text = formatNumber(v);
                return (
                  <td key={col.key} className="rp-num">
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { settings } = useAppSettings();
  const currency = settings.currency || 'INR';

  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => presetRange('30d'));
  const [productId, setProductId] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  const rangeInvalid = Boolean(range.from && range.to && range.from > range.to);

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const { data: next } = await api.get('/reports', {
        params: {
          from: range.from || undefined,
          to: range.to || undefined,
          product_id: productId || undefined,
          user_id: isAdmin && ownerId ? ownerId : undefined,
        },
      });
      if (id !== reqId.current) return;
      setData(next);
      setError('');
    } catch (err) {
      if (id !== reqId.current) return;
      const msg = apiError(err, 'Failed to load reports');
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range.from, range.to, productId, ownerId, isAdmin, rangeInvalid]);

  useEffect(() => {
    load();
  }, [load]);

  const choosePreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const setCustom = (field, value) => {
    setPreset('custom');
    setRange((prev) => ({ ...prev, [field]: value }));
  };

  const exportLeads = async () => {
    setExporting(true);
    try {
      const res = await api.get('/leads/export', {
        params: {
          format: 'xlsx',
          created_from: range.from || undefined,
          created_to: range.to || undefined,
          product_id: productId || undefined,
          assigned_to: isAdmin && ownerId ? ownerId : undefined,
        },
        responseType: 'blob',
      });
      downloadBlob(res.data, `leads-${range.from || 'all'}-to-${range.to || 'today'}.xlsx`);
      toast.success('Export ready');
    } catch (err) {
      toast.error(await blobError(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  // ----- derived chart data -----
  const summary = data?.summary || {};
  const granularity = data?.range?.granularity || 'day';

  const trend = useMemo(
    () =>
      (data?.trend || []).map((row) => ({
        ...row,
        label: shortDate(row.date),
      })),
    [data]
  );
  const trendEmpty = trend.every((r) => !r.created && !r.won && !r.lost);

  const funnel = data?.funnel || [];
  const funnelMax = Math.max(1, ...funnel.map((f) => Number(f.count) || 0));
  const funnelEmpty = funnel.every((f) => !f.count);
  const overallConversion =
    funnel.length > 1 && funnel[0].count
      ? (Number(funnel[funnel.length - 1].count) / Number(funnel[0].count)) * 100
      : null;

  const aging = useMemo(
    () =>
      (data?.stage_aging || []).map((row) => ({
        ...row,
        label: stageLabel(row.status),
        days: row.avg_days_in_stage == null ? 0 : Number(row.avg_days_in_stage),
      })),
    [data]
  );
  const agingEmpty = aging.every((a) => !a.count);

  const sources = useMemo(
    () =>
      (data?.by_source || []).map((row) => ({
        ...row,
        label: sourceLabel(row.source),
        total: Number(row.total) || 0,
        won: Number(row.won) || 0,
      })),
    [data]
  );

  const lostReasons = useMemo(
    () => (data?.lost_reasons || []).map((r) => ({ name: r.reason || 'Not specified', value: Number(r.total) || 0 })),
    [data]
  );
  const lostTotal = lostReasons.reduce((s, r) => s + r.value, 0);

  const activities = useMemo(
    () =>
      Object.entries(data?.activities_by_type || {})
        .map(([type, count]) => ({ type, label: activityLabel(type), count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count),
    [data]
  );
  const activitiesEmpty = activities.every((a) => !a.count);

  const team = data?.team || [];

  const nothingAtAll =
    data &&
    !summary.leads_created &&
    !summary.won &&
    !summary.lost &&
    !summary.activities_logged;

  const rangeText = data?.range
    ? `${formatDateTime(data.range.from, { day: 'numeric', month: 'short', year: 'numeric' })} – ${formatDateTime(
        data.range.to,
        { day: 'numeric', month: 'short', year: 'numeric' }
      )}`
    : '';

  return (
    <div className="page rp-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Insights</span>
          <h1>Reports</h1>
          <p>
            {isAdmin
              ? 'Pipeline health, conversion and team performance for the selected period.'
              : 'Your pipeline, conversion and activity for the selected period.'}
          </p>
        </div>
        <div className="page-header-actions">
          <RefreshButton onRefresh={load} />
          <button type="button" className="btn primary" onClick={exportLeads} disabled={exporting || rangeInvalid}>
            <FiDownload size={15} />
            {exporting ? 'Exporting…' : 'Export leads'}
          </button>
        </div>
      </header>

      <section className="panel rp-toolbar">
        <div className="rp-presets">
          <div className="segmented" role="tablist" aria-label="Date range">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={preset === p.key}
                className={preset === p.key ? 'active' : ''}
                onClick={() => choosePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`rp-filters ${isAdmin ? 'rp-filters-admin' : ''}`}>
          <label className="rp-field">
            <span>From</span>
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => setCustom('from', e.target.value)}
              className={rangeInvalid ? 'invalid' : ''}
            />
          </label>
          <label className="rp-field">
            <span>To</span>
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => setCustom('to', e.target.value)}
              className={rangeInvalid ? 'invalid' : ''}
            />
          </label>
          <div className="rp-field">
            <span>Product</span>
            <SearchableSelect
              value={productId}
              valueLabel={productLabel}
              loadOptions={loadAllProductsOptions}
              placeholder="All products"
              onChange={(val, opt) => {
                setProductId(val || '');
                setProductLabel(opt?.label || '');
              }}
            />
          </div>
          {isAdmin ? (
            <div className="rp-field">
              <span>Owner</span>
              <SearchableSelect
                value={ownerId}
                valueLabel={ownerLabel}
                loadOptions={loadUsersOptions}
                placeholder="Whole team"
                onChange={(val, opt) => {
                  setOwnerId(val || '');
                  setOwnerLabel(opt?.label || '');
                }}
              />
            </div>
          ) : null}
        </div>
        {rangeInvalid ? <p className="rp-range-error">“From” must be on or before “To”.</p> : null}
        {rangeText && !rangeInvalid ? (
          <p className="rp-range-note">
            Showing {rangeText} · {data.range.days} day{data.range.days === 1 ? '' : 's'} · grouped by{' '}
            {granularity === 'week' ? 'week' : 'day'}
          </p>
        ) : null}
      </section>

      {!data && loading ? (
        <ReportsSkeleton />
      ) : !data && error ? (
        <section className="panel">
          <EmptyState
            icon={FiAlertCircle}
            title="Couldn't load reports"
            action={
              <button type="button" className="btn" onClick={load}>
                Try again
              </button>
            }
          >
            {error}
          </EmptyState>
        </section>
      ) : data ? (
        <div className={`rp-body ${loading ? 'rp-loading' : ''}`} aria-busy={loading}>
          <section className="rp-kpis">
            <Kpi label="Leads created" value={formatNumber(summary.leads_created)} icon={FiUserPlus} tone="blue" />
            <Kpi
              label="Won"
              value={formatNumber(summary.won)}
              sub={`${formatCurrency(summary.won_value || 0, { currency })} won value`}
              icon={FiAward}
              tone="emerald"
            />
            <Kpi
              label="Win rate"
              value={dash(summary.win_rate, '%')}
              sub={`${formatNumber(summary.won)} won · ${formatNumber(summary.lost)} lost`}
              icon={FiPercent}
              tone="teal"
            />
            <Kpi
              label="Avg days to win"
              value={dash(summary.avg_days_to_win)}
              sub="From creation to won"
              icon={FiClock}
              tone="sky"
            />
            <Kpi
              label="Open pipeline"
              value={formatCurrency(summary.open_value || 0, { currency, compact: true })}
              sub={`${formatNumber(summary.open_leads)} leads · ${formatCurrency(summary.weighted_forecast || 0, {
                currency,
                compact: true,
              })} weighted`}
              icon={FiTrendingUp}
              tone="lime"
            />
            <Kpi
              label="Activities logged"
              value={formatNumber(summary.activities_logged)}
              sub={`${formatNumber(summary.calls)} calls · ${formatNumber(summary.followups_completed)} follow-ups done`}
              icon={FiActivity}
              tone="cyan"
            />
            <Kpi
              label="Overdue follow-ups"
              value={formatNumber(summary.overdue_followups)}
              sub={Number(summary.overdue_followups) > 0 ? 'Need attention now' : 'All caught up'}
              icon={FiAlertCircle}
              tone={Number(summary.overdue_followups) > 0 ? 'rose' : 'emerald'}
              highlight={Number(summary.overdue_followups) > 0}
            />
          </section>

          {nothingAtAll ? (
            <section className="panel">
              <EmptyState icon={FiBarChart2} title="No activity in this period">
                Nothing was created, won, lost or logged between these dates. Try a wider range or clear the filters.
              </EmptyState>
            </section>
          ) : null}

          <section className="rp-grid">
            <ChartPanel
              wide
              title="Lead trend"
              subtitle={`Created, won and lost per ${granularity === 'week' ? 'week' : 'day'}`}
              empty={trendEmpty}
            >
              <div className="rp-chart-body">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      {[
                        ['created', TONE_HEX.indigo],
                        ['won', TONE_HEX.emerald],
                        ['lost', TONE_HEX.rose],
                      ].map(([key, color]) => (
                        <linearGradient key={key} id={`rp-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      {...TOOLTIP_PROPS}
                      cursor={{ stroke: 'var(--line-strong)' }}
                      labelFormatter={(label, payload) =>
                        granularity === 'week' && payload?.[0]?.payload?.date
                          ? `Week of ${formatDateTime(payload[0].payload.date, { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : label
                      }
                    />
                    <Legend {...LEGEND_PROPS} />
                    <Area type="monotone" dataKey="created" name="Created" stroke={TONE_HEX.indigo} strokeWidth={2} fill="url(#rp-grad-created)" />
                    <Area type="monotone" dataKey="won" name="Won" stroke={TONE_HEX.emerald} strokeWidth={2} fill="url(#rp-grad-won)" />
                    <Area type="monotone" dataKey="lost" name="Lost" stroke={TONE_HEX.rose} strokeWidth={2} fill="url(#rp-grad-lost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel
              title="Conversion funnel"
              subtitle={
                overallConversion != null
                  ? `Leads created in range · ${dash(overallConversion, '%')} reached Won`
                  : 'Leads created in range, by furthest stage reached'
              }
              empty={funnelEmpty}
            >
              <ol className="rp-funnel">
                {funnel.map((step, i) => {
                  const count = Number(step.count) || 0;
                  const width = Math.max(count ? 3 : 0, (count / funnelMax) * 100);
                  return (
                    <li key={step.stage}>
                      {i > 0 ? (
                        <span className="rp-funnel-conv" title="Conversion from previous step">
                          <FiChevronDown size={12} />
                          {dash(step.conversion_from_previous, '%')}
                        </span>
                      ) : null}
                      <div className="rp-funnel-row">
                        <span className="rp-funnel-label">{stageLabel(step.stage)}</span>
                        <div className="rp-funnel-track">
                          <span
                            className="rp-funnel-bar"
                            style={{ width: `${width}%`, background: STAGE_HEX[step.stage] || TONE_HEX.indigo }}
                          />
                        </div>
                        <strong className="rp-funnel-count">{formatNumber(count)}</strong>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ChartPanel>

            <ChartPanel title="Stage aging" subtitle="Average days open leads have sat in their current stage" empty={agingEmpty} emptyText="No open leads.">
              <div className="rp-chart-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={aging} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="var(--line)" />
                    <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={92} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      {...TOOLTIP_PROPS}
                      formatter={(value, _name, item) => [
                        item?.payload?.avg_days_in_stage == null ? '—' : `${dash(value)} days`,
                        'Avg in stage',
                      ]}
                    />
                    <Bar dataKey="days" name="Avg days" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {aging.map((row) => (
                        <Cell key={row.status} fill={STAGE_HEX[row.status] || TONE_HEX.indigo} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="rp-aging-list">
                {aging.map((row) => (
                  <li key={row.status}>
                    <span className="rp-aging-stage">
                      <i style={{ background: STAGE_HEX[row.status] }} />
                      {row.label}
                    </span>
                    <span>{formatNumber(row.count)} leads</span>
                    <span>{formatCurrency(row.value || 0, { currency, compact: true })}</span>
                    <strong>{row.avg_days_in_stage == null ? '—' : `${dash(row.avg_days_in_stage)} d`}</strong>
                  </li>
                ))}
              </ul>
            </ChartPanel>

            <ChartPanel title="Leads by source" subtitle="Created in range, with how many were won" empty={!sources.length}>
              <div className="rp-chart-body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sources} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} minTickGap={0} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      {...TOOLTIP_PROPS}
                      formatter={(value, name, item) =>
                        name === 'Won' && item?.payload?.won_value
                          ? [`${formatNumber(value)} (${formatCurrency(item.payload.won_value, { currency })})`, name]
                          : [formatNumber(value), name]
                      }
                    />
                    <Legend {...LEGEND_PROPS} />
                    <Bar dataKey="total" name="Leads" fill={TONE_HEX.indigo} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="won" name="Won" fill={TONE_HEX.emerald} radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel title="Lost reasons" subtitle={`${formatNumber(lostTotal)} leads lost in range`} empty={!lostTotal} emptyText="No lost leads in this range.">
              <div className="rp-donut">
                <div className="rp-donut-chart">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => [formatNumber(value), name]} />
                      <Pie
                        data={lostReasons}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="92%"
                        paddingAngle={lostReasons.length > 1 ? 2 : 0}
                        stroke="var(--surface)"
                        strokeWidth={2}
                      >
                        {lostReasons.map((r, i) => (
                          <Cell key={r.name} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="rp-legend-list">
                  {lostReasons.map((r, i) => (
                    <li key={r.name}>
                      <i style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span>{r.name}</span>
                      <strong>{formatNumber(r.value)}</strong>
                      <small>{lostTotal ? Math.round((r.value / lostTotal) * 100) : 0}%</small>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartPanel>

            <ChartPanel title="Activities by type" subtitle={`${formatNumber(summary.activities_logged)} logged in range`} empty={activitiesEmpty} emptyText="No activities logged in this range.">
              <div className="rp-chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={activities} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <Tooltip {...TOOLTIP_PROPS} formatter={(value) => [formatNumber(value), 'Activities']} />
                    <Bar dataKey="count" name="Activities" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {activities.map((a) => (
                        <Cell key={a.type} fill={ACTIVITY_HEX[a.type] || TONE_HEX.indigo} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </section>

          {isAdmin && team.length ? (
            <section className="panel leads-panel rp-team">
              <div className="leads-toolbar-title">
                <h2>Team leaderboard</h2>
                <span className="count-chip">{team.length} people</span>
              </div>
              <p className="panel-subtitle rp-team-sub">Click a column header to sort. Overdue follow-ups are highlighted.</p>
              <TeamTable team={team} currency={currency} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
