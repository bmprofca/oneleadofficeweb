import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiSun,
  FiUser,
  FiVideo,
} from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import RefreshButton from '../components/RefreshButton';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/crm/Badges';
import TaskRow from '../components/my-day/TaskRow';
import CompleteCallbackModal from '../components/my-day/CompleteCallbackModal';
import { dateKeyOf, dayLabel, istDateKey, timeOf } from '../components/my-day/time';
import { formatDateTime, formatOptionLabel } from '../utils/format';
import { apiError } from '../utils/crm';
import '../styles/my-day.css';

const EMPTY = { counts: {}, overdue: [], today: [], upcoming: [], completed_today: [], appointments: [] };

const PLATFORM_LABEL = { meet: 'Google Meet', call: 'Phone call', zoom: 'Zoom', teams: 'Teams', in_person: 'In person', other: 'Other' };

function headerDate() {
  return new Date().toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function greeting() {
  const hour = Number(
    new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function groupByDay(items, field) {
  const groups = [];
  const index = {};
  items.forEach((item) => {
    const key = dateKeyOf(item[field]);
    if (!index[key]) {
      index[key] = { key, label: dayLabel(key), items: [] };
      groups.push(index[key]);
    }
    index[key].items.push(item);
  });
  return groups;
}

function Section({ id, title, count, tone, icon: Icon, subtitle, children, collapsible, open = true, onToggle }) {
  const Heading = collapsible ? 'button' : 'div';
  return (
    <section id={id} className={`panel md-section md-section-${tone}`}>
      <Heading
        className={`md-section-head${collapsible ? ' is-toggle' : ''}`}
        {...(collapsible ? { type: 'button', onClick: onToggle, 'aria-expanded': open } : {})}
      >
        <span className="md-section-icon">
          <Icon size={15} />
        </span>
        <div className="md-section-title">
          <h2>{title}</h2>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
        <span className="count-chip">{count}</span>
        {collapsible ? <FiChevronDown size={16} className={`md-chevron${open ? ' open' : ''}`} /> : null}
      </Heading>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="md-section-body"
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function MyDaySkeleton() {
  return (
    <>
      <section className="md-kpis">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat-card md-kpi">
            <Skeleton width="60%" height={10} />
            <Skeleton width="30%" height={22} />
          </div>
        ))}
      </section>
      {Array.from({ length: 2 }).map((_, i) => (
        <section key={i} className="panel md-skel">
          <Skeleton width={160} height={16} />
          <div className="md-skel-rows">
            {Array.from({ length: 3 }).map((__, r) => (
              <Skeleton key={r} height={48} radius={10} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export default function MyDay() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [scope, setScope] = useState('mine');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState({});
  const requestRef = useRef(0);

  const teamView = isAdmin && scope === 'all';

  const load = useCallback(async () => {
    const rid = ++requestRef.current;
    try {
      const { data: next } = await api.get('/tasks', { params: teamView ? { scope: 'all' } : {} });
      if (rid !== requestRef.current) return false;
      setData({ ...EMPTY, ...next });
      return true;
    } catch (err) {
      if (rid !== requestRef.current) return false;
      toast.error(apiError(err, 'Failed to load your day'));
      setData((prev) => prev || EMPTY);
      return false;
    } finally {
      if (rid === requestRef.current) setLoading(false);
    }
  }, [teamView]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const setBusy = (id, value) =>
    setBusyIds((prev) => {
      const next = { ...prev };
      if (value) next[id] = true;
      else delete next[id];
      return next;
    });

  /** Drop a reminder from the open lists locally (optimistic). */
  const removeLocally = (id) =>
    setData((prev) =>
      prev
        ? {
            ...prev,
            overdue: prev.overdue.filter((t) => t.id !== id),
            today: prev.today.filter((t) => t.id !== id),
            upcoming: prev.upcoming.filter((t) => t.id !== id),
          }
        : prev
    );

  const completeTask = async ({ outcome, note } = {}) => {
    const task = completing;
    if (!task) return;
    setSaving(true);
    try {
      await api.post(`/reminders/${task.id}/complete`, { outcome, note, type: 'call' });
      removeLocally(task.id);
      setCompleting(null);
      toast.success(outcome ? `Callback completed — ${outcome}` : 'Callback completed');
    } catch (err) {
      toast.error(apiError(err, 'Could not complete this callback'));
    } finally {
      setSaving(false);
      load();
    }
  };

  const snoozeTask = async (task, payload, label) => {
    setBusy(task.id, true);
    try {
      await api.post(`/reminders/${task.id}/snooze`, payload);
      toast.success(`Snoozed — ${label.toLowerCase()}`);
    } catch (err) {
      toast.error(apiError(err, 'Could not snooze this callback'));
    } finally {
      await load();
      setBusy(task.id, false);
    }
  };

  const d = data || EMPTY;
  const counts = d.counts || {};
  const upcomingGroups = useMemo(() => groupByDay(d.upcoming || [], 'remind_at'), [d.upcoming]);
  const todayKey = istDateKey();
  const caughtUp = data && d.overdue.length === 0 && d.today.length === 0;

  const kpis = [
    { key: 'overdue', label: 'Overdue', value: counts.overdue ?? d.overdue.length, tone: 'rose', icon: FiAlertCircle, target: d.overdue.length ? 'md-overdue' : null },
    { key: 'today', label: 'Due today', value: counts.today ?? d.today.length, tone: 'amber', icon: FiSun, target: 'md-today' },
    { key: 'upcoming', label: 'Next 7 days', value: counts.upcoming ?? d.upcoming.length, tone: 'sky', icon: FiClock, target: 'md-upcoming' },
    { key: 'meetings', label: 'Meetings today', value: counts.appointments_today ?? 0, tone: 'blue', icon: FiCalendar, target: 'md-appointments' },
    { key: 'done', label: 'Completed today', value: counts.completed_today ?? d.completed_today.length, tone: 'emerald', icon: FiCheckCircle, target: 'md-completed' },
  ];

  const jumpTo = (kpi) => {
    if (!kpi.target) return;
    if (kpi.key === 'done') setShowCompleted(true);
    requestAnimationFrame(() => {
      document.getElementById(kpi.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const rowProps = {
    showOwner: teamView,
    onComplete: setCompleting,
    onSnooze: snoozeTask,
  };

  const renderRows = (items, variant) => (
    <ul className="md-list">
      {items.map((task) => (
        <TaskRow key={task.id} task={task} variant={variant} busy={!!busyIds[task.id]} {...rowProps} />
      ))}
    </ul>
  );

  return (
    <div className="page md-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">
            {greeting()}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </span>
          <h1>Today, {headerDate()}</h1>
          <p>{teamView ? "Your team's callbacks and meetings, in one place." : 'Your callbacks and meetings, in the order they need you.'}</p>
        </div>
        <div className="page-header-actions">
          {isAdmin ? (
            <div className="segmented" role="group" aria-label="Whose tasks">
              <button type="button" className={scope === 'mine' ? 'active' : ''} aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
                Mine
              </button>
              <button type="button" className={scope === 'all' ? 'active' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
                Whole team
              </button>
            </div>
          ) : null}
          <RefreshButton
            onRefresh={async () => {
              if (await load()) toast.success('Up to date');
            }}
          />
        </div>
      </header>

      {loading && !data ? (
        <MyDaySkeleton />
      ) : (
        <div className={`md-content${loading ? ' is-loading' : ''}`}>
          <section className="md-kpis" aria-label="Today at a glance">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              const highlight = kpi.key === 'overdue' && kpi.value > 0;
              return (
                <button
                  key={kpi.key}
                  type="button"
                  className={`stat-card md-kpi stat-tone-${kpi.tone}${highlight ? ' is-alert' : ''}`}
                  onClick={() => jumpTo(kpi)}
                  disabled={!kpi.target}
                >
                  <span className="md-kpi-top">
                    <span>{kpi.label}</span>
                    <span className="stat-icon">
                      <Icon size={15} />
                    </span>
                  </span>
                  <strong>{Number(kpi.value || 0).toLocaleString('en-IN')}</strong>
                </button>
              );
            })}
          </section>

          {d.overdue.length > 0 ? (
            <Section id="md-overdue" title="Overdue" count={d.overdue.length} tone="danger" icon={FiAlertCircle} subtitle="Oldest first — clear these before anything else">
              {renderRows(d.overdue, 'overdue')}
            </Section>
          ) : null}

          {caughtUp ? (
            <section id="md-today" className="panel md-caught-up">
              <motion.span
                className="md-caught-up-icon"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                <FiCheckCircle size={26} />
              </motion.span>
              <div>
                <h2>You're all caught up</h2>
                <p>
                  Nothing overdue and nothing else due today
                  {d.completed_today.length
                    ? ` — ${d.completed_today.length} callback${d.completed_today.length === 1 ? '' : 's'} done so far.`
                    : '.'}
                </p>
              </div>
              <Link to="/leads" className="btn small">
                Find leads to call
              </Link>
            </section>
          ) : (
            <Section id="md-today" title="Due today" count={d.today.length} tone="warning" icon={FiSun} subtitle="Still to do before the day ends">
              {d.today.length ? renderRows(d.today, 'today') : <p className="md-inline-empty">Nothing else is scheduled for today.</p>}
            </Section>
          )}

          <Section id="md-upcoming" title="Upcoming" count={d.upcoming.length} tone="info" icon={FiClock} subtitle="Next 7 days">
            {upcomingGroups.length ? (
              upcomingGroups.map((group) => (
                <div key={group.key} className="md-day-group">
                  <div className="md-day-label">
                    <span>{group.label}</span>
                    <small>{group.items.length}</small>
                  </div>
                  {renderRows(group.items, 'upcoming')}
                </div>
              ))
            ) : (
              <p className="md-inline-empty">No callbacks scheduled for the coming week.</p>
            )}
          </Section>

          <Section id="md-appointments" title="Appointments" count={d.appointments.length} tone="brand" icon={FiCalendar} subtitle="Scheduled meetings, next 7 days">
            {d.appointments.length ? (
              <ul className="md-list">
                {d.appointments.map((a) => {
                  const key = dateKeyOf(a.start_at);
                  return (
                    <li key={a.id} className={`md-appt${key === todayKey ? ' is-today' : ''}`}>
                      <div className="md-appt-when" title={formatDateTime(a.start_at)}>
                        <span>{dayLabel(key)}</span>
                        <strong>{timeOf(a.start_at)}</strong>
                      </div>
                      <div className="md-row-main">
                        <div className="md-row-title">
                          <strong title={a.title}>{a.title}</strong>
                        </div>
                        <div className="md-row-meta">
                          {a.lead_id ? (
                            <Link to={`/leads/${encodeURIComponent(a.lead_id)}`} className="md-lead-link">
                              {a.lead_name || 'Lead'}
                            </Link>
                          ) : null}
                          {a.product_name ? <span className="md-meta-item">{a.product_name}</span> : null}
                          <span className="md-meta-item">
                            <FiVideo size={11} aria-hidden="true" />
                            {PLATFORM_LABEL[a.platform] || formatOptionLabel(a.platform)}
                          </span>
                          {a.location ? <span className="md-meta-item">{a.location}</span> : null}
                          {teamView && a.assigned_name ? (
                            <span className="md-meta-item md-owner">
                              <FiUser size={11} aria-hidden="true" />
                              {a.assigned_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="md-inline-empty">
                No meetings booked. <Link to="/appointments">Open appointments</Link>
              </p>
            )}
          </Section>

          <Section
            id="md-completed"
            title="Completed today"
            count={d.completed_today.length}
            tone="success"
            icon={FiCheckCircle}
            collapsible
            open={showCompleted}
            onToggle={() => setShowCompleted((v) => !v)}
          >
            {d.completed_today.length ? (
              renderRows(d.completed_today, 'done')
            ) : (
              <EmptyState icon={FiCheckCircle} title="Nothing completed yet">
                Callbacks you complete today will be listed here.
              </EmptyState>
            )}
          </Section>
        </div>
      )}

      <CompleteCallbackModal task={completing} saving={saving} onConfirm={completeTask} onClose={() => setCompleting(null)} />
    </div>
  );
}
