import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiMonitor, FiTrash2, FiUser } from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import FormField from '../components/FormField';
import RefreshButton from '../components/RefreshButton';
import { formatOptionLabel } from '../utils/format';
import {
  clearFieldError,
  validateForm,
  validators,
} from '../utils/validation';

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, setUserFromProfile, logout } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    const { data } = await api.get('/auth/me');
    setUserFromProfile(data);
    setForm({
      name: data.name || '',
      email: data.email || '',
    });
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => clearFieldError(prev, name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        name: [
          validators.required('Full name is required'),
          validators.minLength(2, 'Name must be at least 2 characters'),
        ],
        email: [validators.email('Enter a valid email address')],
      },
      form
    );
    setErrors(result.errors);
    if (!result.valid) return;

    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', form);
      setUserFromProfile(data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const endLocalSession = async () => {
    await logout();
    navigate('/login');
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.type === 'one') {
        const { data } = await api.delete(`/auth/sessions/${confirm.sessionId}`);
        toast.success('Session terminated');
        if (data.currentEnded) {
          await endLocalSession();
          return;
        }
        await loadSessions();
      } else if (confirm.type === 'others') {
        const { data } = await api.post('/auth/sessions/revoke-others');
        toast.success(
          data.count
            ? `Terminated ${data.count} other session${data.count === 1 ? '' : 's'}`
            : 'No other sessions to terminate'
        );
        await loadSessions();
      }
      setConfirm(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Profile</h1>
          <p>View and update your account details.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await Promise.all([refreshProfile(), loadSessions()]);
                toast.success('Profile refreshed');
              } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to refresh');
              }
            }}
          />
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>
            <FiUser size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Account
          </h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <FormField label="Full name *" error={errors.name}>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Enter your full name"
              className={errors.name ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="Enter your email"
              className={errors.email ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Mobile">
            <input value={user?.phone || ''} disabled placeholder="Mobile number" />
          </FormField>
          <FormField label="Role">
            <input
              value={formatOptionLabel(user?.role || '')}
              disabled
              placeholder="Role"
            />
          </FormField>
          <div className="full">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header sessions-header">
          <div>
            <h2>
              <FiMonitor size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Active sessions
            </h2>
            <p className="panel-subtitle">
              Devices signed in to your account. Terminate any you do not recognize.
            </p>
          </div>
          <button
            type="button"
            className="btn ghost"
            disabled={
              sessionsLoading ||
              sessions.filter((s) => !s.current).length === 0 ||
              actionLoading
            }
            onClick={() =>
              setConfirm({
                type: 'others',
                title: 'Terminate other sessions?',
                message:
                  'All other devices will be signed out. This device will stay signed in.',
                confirmLabel: 'Terminate others',
              })
            }
          >
            Terminate others
          </button>
        </div>

        {sessionsLoading ? (
          <p className="muted">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="muted">No active sessions found.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={`session-item${session.current ? ' current' : ''}`}
              >
                <div className="session-main">
                  <div className="session-title-row">
                    <strong>{session.device}</strong>
                    {session.current ? (
                      <span className="session-badge">This device</span>
                    ) : null}
                  </div>
                  <div className="session-meta">
                    <span>IP: {session.ipAddress || '—'}</span>
                    <span>Signed in: {formatWhen(session.createdAt)}</span>
                    <span>Last active: {formatWhen(session.lastSeenAt)}</span>
                    <span>Expires: {formatWhen(session.expiresAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn small danger"
                  disabled={actionLoading}
                  onClick={() =>
                    setConfirm({
                      type: 'one',
                      sessionId: session.id,
                      title: session.current
                        ? 'Sign out this device?'
                        : 'Terminate session?',
                      message: session.current
                        ? 'You will be signed out of this device immediately.'
                        : 'That device will lose access until the user signs in again.',
                      confirmLabel: session.current ? 'Sign out' : 'Terminate',
                    })
                  }
                >
                  <FiTrash2 size={14} />
                  {session.current ? 'Sign out' : 'Terminate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || 'Confirm'}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        loading={actionLoading}
        onConfirm={runConfirm}
        onClose={() => {
          if (!actionLoading) setConfirm(null);
        }}
      />
    </div>
  );
}
