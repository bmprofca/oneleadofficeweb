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
  FiPackage,
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

const CHART_COLORS = ['#0d9488', '#2563eb', '#d97706', '#059669', '#e11d48', '#0891b2', '#ca8a04'];

const STATUS_COLORS = {
  new: '#2563eb',
  contacted: '#0891b2',
  qualified: '#0d9488',
  proposal: '#d97706',
  negotiation: '#ca8a04',
  won: '#059669',
  lost: '#e11d48',
  not_interested: '#64748b',
};

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

  const cards = [
    {
      label: 'Total Leads',
      value: data.leads.total_leads || 0,
      icon: FiUsers,
      tone: 'teal',
      to: '/leads',
    },
    {
      label: 'New Leads',
      value: data.leads.new_leads || 0,
      icon: FiUserPlus,
      tone: 'sky',
      to: '/leads?status=new',
    },
    {
      label: 'In Progress',
      value: data.leads.in_progress_leads || 0,
      icon: FiActivity,
      tone: 'amber',
      // Multiple statuses — no single filter link
    },
    {
      label: 'Won',
      value: data.leads.won_leads || 0,
      icon: FiAward,
      tone: 'emerald',
      to: '/leads?status=won',
    },
    {
      label: 'Lost',
      value: data.leads.lost_leads || 0,
      icon: FiAlertCircle,
      tone: 'rose',
      to: '/leads?status=lost',
    },
    {
      label: 'Upcoming Reminders',
      value: data.reminders.upcoming_reminders || 0,
      icon: FiBell,
      tone: 'cyan',
      to: '/reminders',
    },
    {
      label: 'Scheduled Appointments',
      value: data.appointments.scheduled_appointments || 0,
      icon: FiCalendar,
      tone: 'blue',
      to: '/appointments',
    },
    {
      label: 'Active Products',
      value: productData.length,
      icon: FiPackage,
      tone: 'lime',
      to: '/products',
    },
  ];

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <h1>Welcome, {user?.name}</h1>
          <p>A colorful snapshot of leads, reminders, and appointments.</p>
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
              <span className="stat-icon">
                <Icon size={14} />
              </span>
              <div className="stat-card-body">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
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
                  className={`stat-card stat-card-h stat-card-link stat-tone-${card.tone}`}
                >
                  {content}
                </Link>
              </motion.div>
            );
          }

          return (
            <motion.article
              key={card.label}
              className={`stat-card stat-card-h stat-tone-${card.tone}`}
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
            <h2>Leads by status</h2>
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Leads"
                    radius={[0, 8, 8, 0]}
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
            <h2>Appointments calendar</h2>
          </div>
          <div className="chart-body chart-body-calendar chart-body-fill">
            <AppointmentsCalendar appointments={data.calendarAppointments || []} />
          </div>
        </article>

        <article className="panel chart-panel chart-panel-wide">
          <div className="panel-header">
            <h2>Leads per product</h2>
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="leads" name="Leads" radius={[0, 8, 8, 0]}>
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
      </section>
    </div>
  );
}
