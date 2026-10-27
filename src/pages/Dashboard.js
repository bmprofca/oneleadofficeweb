import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiUserPlus,
  FiAward,
  FiBell,
  FiCalendar,
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiTrendingUp,
  FiClock,
  FiPhone,
  FiMessageCircle,
  FiMail,
  FiMessageSquare,
  FiFileText,
  FiZap,
} from 'react-icons/fi';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppointmentsCalendar from '../components/AppointmentsCalendar';
import RefreshButton from '../components/RefreshButton';
import { DashboardSkeleton } from '../components/Skeleton';
import { formatOptionLabel } from '../utils/format';
import { formatCurrency, formatRelative, isOverdue, activityLabel } from '../utils/crm';
import { EmptyState, ScoreRing, StageBadge } from '../components/crm/Badges';
import '../styles/leads-upgrade.css';

const ACTIVITY_ICONS = {
  call: FiPhone,
  whatsapp: FiMessageCircle,
  email: FiMail,
  meeting: FiCalendar,
  message: FiMessageSquare,
  note: FiFileText,
};

const excerpt = (text, max = 90) => {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981'];

const STATUS_COLORS = {
  new: '#3b82f6',
  contacted: '#06b6d4',
  qualified: '#6366f1',
  proposal: '#f59e0b',
  negotiation: '#f97316',
  won: '#10b981',
  lost: '#f43f5e',
  not_interested: '#94a3b8',
};

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted)' };

const TOOLTIP_PROPS = {
  cursor: { fill: 'color-mix(in srgb, var(--brand) 6%, transparent)' },
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-md)',
    fontSize: 12,
    padding: '8px 12px',
  },
  labelStyle: { color: 'var(--ink)', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'var(--ink-2)', padding: 0 },
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    const { data: next } = await api.get('/dashboard');
    setData(next);
  };

  useEffect(() => {
    loadDashboard().catch((err) => {
      toast.error(err.response?.data?.message || 'Failed to load dashboard');
      setError(err.response?.data?.message || 'Failed to load dashboard');
    });
  }, []);

  const leadStatusData = useMemo(
    () =>
      (data?.leadByStatus || []).map((row) => ({
        name: formatOptionLabel(row.status),
        value: Number(row.total) || 0,
        status: row.status,
      })),
    [data]
  );

  const productData = useMemo(
    () =>
      (data?.productLeadCounts || []).map((row) => ({
        name: row.name,
        leads: Number(row.total) || 0,
      })),
    [data]
  );

  if (error) return <div className="page-loading">Unable to load dashboard.</div>;
  if (!data) return <DashboardSkeleton />;

  const leadsStats = data.leads || {};
  const reminderStats = data.reminders || {};
  const hotLeads = data.hotLeads || [];
  const recentActivity = data.recentActivity || [];

  const cards = [
    {
      label: 'Total Leads',
      value: leadsStats.total_leads || 0,
      icon: FiUsers,
      tone: 'teal',
      to: '/leads',
    },
    {
      label: 'New Leads',
      value: leadsStats.new_leads || 0,
      icon: FiUserPlus,
      tone: 'sky',
      to: '/leads?status=new',
    },
    {
      label: 'In Progress',
      value: leadsStats.in_progress_leads || 0,
      icon: FiActivity,
      tone: 'amber',
      // Multiple statuses — no single filter link
    },
    {
      label: 'Pipeline value',
      display: formatCurrency(leadsStats.open_value || 0, { compact: true }),
      sub: `${Number(leadsStats.open_leads || 0).toLocaleString()} open leads`,
      icon: FiTrendingUp,
      tone: 'blue',
      to: '/pipeline',
    },
    {
      label: 'Won this month',
      value: leadsStats.won_this_month || 0,
      sub: `${formatCurrency(leadsStats.won_value || 0, { compact: true })} won value`,
      icon: FiAward,
      tone: 'emerald',
      to: '/leads?status=won',
    },
    {
      label: 'Due today',
      value: reminderStats.due_today_reminders || 0,
      sub: `${Number(reminderStats.upcoming_reminders || 0).toLocaleString()} upcoming`,
      icon: FiBell,
      tone: 'cyan',
      to: '/tasks',
    },
    {
      label: 'Overdue follow-ups',
      value: reminderStats.overdue_reminders || 0,
      icon: FiAlertCircle,
      tone: 'rose',
      to: '/leads?callback=overdue',
    },
    {
      label: 'Scheduled Appointments',
      value: data.appointments?.scheduled_appointments || 0,
      icon: FiCalendar,
      tone: 'blue',
      to: '/appointments',
    },
  ];

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Overview</span>
          <h1>
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p>Here's how your pipeline, reminders and appointments look today.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await loadDashboard();
                toast.success('Dashboard refreshed');
              } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to refresh');
              }
            }}
          />
        </div>
      </header>

      <section className="stat-grid">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const clickable = Boolean(card.to);
          const content = (
            <>
              <div className="stat-card-top">
                <span>{card.label}</span>
                <span className="stat-icon">
                  <Icon size={17} />
                </span>
              </div>
              <div className="stat-card-foot">
                <div className="lu-kpi-value">
                  <strong>{card.display ?? Number(card.value).toLocaleString()}</strong>
                  {card.sub ? <small>{card.sub}</small> : null}
                </div>
                {clickable && (
                  <span className="stat-card-link-hint">
                    View <FiArrowUpRight size={13} />
                  </span>
                )}
              </div>
            </>
          );

          if (clickable) {
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.22 }}
              >
                <Link
                  to={card.to}
                  className={`stat-card stat-card-kpi stat-card-link stat-tone-${card.tone}`}
                >
                  {content}
                </Link>
              </motion.div>
            );
          }

          return (
            <motion.article
              key={card.label}
              className={`stat-card stat-card-kpi stat-tone-${card.tone}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.22 }}
            >
              {content}
            </motion.article>
          );
        })}
      </section>

      <section className="chart-grid chart-grid-match">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Leads by status</h2>
              <p className="panel-subtitle">Click a bar to open matching leads</p>
            </div>
          </div>
          <div className="chart-body chart-body-fill">
            {leadStatusData.every((d) => d.value === 0) ? (
              <p className="chart-empty">No lead data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                <BarChart
                  data={leadStatusData}
                  layout="vertical"
                  margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="var(--line)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...TOOLTIP_PROPS} />
                  <Bar
                    dataKey="value"
                    name="Leads"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={26}
                    cursor="pointer"
                    onClick={(entry) => {
                      const status = entry?.payload?.status;
                      if (status) navigate(`/leads?status=${status}`);
                    }}
                  >
                    {leadStatusData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || CHART_COLORS[0]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Appointments calendar</h2>
              <p className="panel-subtitle">Scheduled meetings this month</p>
            </div>
          </div>
          <div className="chart-body chart-body-calendar chart-body-fill">
            <AppointmentsCalendar appointments={data.calendarAppointments || []} showOwner={user?.role === 'admin'} />
          </div>
        </article>

        <article className="panel chart-panel chart-panel-wide">
          <div className="panel-header">
            <div>
              <h2>Leads per product</h2>
              <p className="panel-subtitle">Distribution of leads across your catalogue</p>
            </div>
          </div>
          <div className="chart-body">
            {productData.every((d) => d.leads === 0) ? (
              <p className="chart-empty">No product lead counts yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={productData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="var(--line)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...TOOLTIP_PROPS} />
                  <Bar dataKey="leads" name="Leads" radius={[0, 6, 6, 0]}
                    maxBarSize={26}
                  >
                    {productData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="panel chart-panel lu-dash-panel">
          <div className="panel-header">
            <div>
              <h2>Hot leads</h2>
              <p className="panel-subtitle">Open leads with the highest score</p>
            </div>
            <Link to="/leads?temperature=hot&sort=score" className="btn small">
              View all
            </Link>
          </div>
          {hotLeads.length === 0 ? (
            <EmptyState icon={FiZap} title="No hot leads yet">
              Leads warm up as you log calls, meetings and stage changes.
            </EmptyState>
          ) : (
            <ul className="lu-hot-list">
              {hotLeads.map((lead) => (
                <li key={lead.id}>
                  <ScoreRing score={lead.score} size={38} />
                  <div className="lu-hot-main">
                    <Link to={`/leads/${encodeURIComponent(lead.id)}`} className="lu-hot-name">
                      {lead.name}
                    </Link>
                    <small>
                      {lead.product_name || '—'}
                      {lead.deal_value != null ? ` · ${formatCurrency(lead.deal_value, { compact: true })}` : ''}
                    </small>
                  </div>
                  <div className="lu-hot-side">
                    <StageBadge status={lead.status} />
                    {lead.next_callback ? (
                      <small
                        className={isOverdue(lead.next_callback) ? 'lu-text-danger' : ''}
                        title="Next callback"
                      >
                        <FiClock size={11} /> {formatRelative(lead.next_callback)}
                      </small>
                    ) : (
                      <small className="crm-muted">No follow-up</small>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel chart-panel lu-dash-panel">
          <div className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p className="panel-subtitle">Latest calls, messages and notes</p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <EmptyState icon={FiActivity} title="No activity yet">
              Calls, WhatsApp messages, meetings and notes logged on leads show up here.
            </EmptyState>
          ) : (
            <ul className="lu-activity-list">
              {recentActivity.map((item) => {
                const Icon = ACTIVITY_ICONS[item.type] || FiActivity;
                const text = excerpt(
                  [item.subject, item.outcome, item.content].filter(Boolean).join(' · ')
                );
                return (
                  <li key={item.id}>
                    <span className="lu-activity-icon" title={activityLabel(item.type)}>
                      <Icon size={14} />
                    </span>
                    <div className="lu-activity-main">
                      <p>
                        <strong>{item.user_name || 'Someone'}</strong>{' '}
                        <span className="crm-muted">
                          {activityLabel(item.type).toLowerCase()}
                          {item.lead_name ? ' · ' : ''}
                        </span>
                        {item.lead_id ? (
                          <Link to={`/leads/${encodeURIComponent(item.lead_id)}`}>
                            {item.lead_name || 'Lead'}
                          </Link>
                        ) : null}
                      </p>
                      {text ? <small>{text}</small> : null}
                    </div>
                    <time className="lu-activity-time">{formatRelative(item.at)}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
