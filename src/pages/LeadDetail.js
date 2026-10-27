import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiArchive,
  FiArrowLeft,
  FiBell,
  FiBox,
  FiCalendar,
  FiEdit3,
  FiGitMerge,
  FiLock,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiRotateCcw,
  FiSearch,
  FiUser,
  FiCompass,
} from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import useAppSettings, { useTags } from '../hooks/useAppSettings';
import ConfirmModal from '../components/ConfirmModal';
import RefreshButton from '../components/RefreshButton';
import { Skeleton } from '../components/Skeleton';
import { EmptyState, ScoreRing, StageBadge, TemperatureBadge } from '../components/crm/Badges';
import StageStepper from '../components/lead-detail/StageStepper';
import { LostReasonModal, WonModal } from '../components/lead-detail/StageModals';
import { AppointmentModal, CallbackModal } from '../components/lead-detail/ScheduleModals';
import ActivityComposer from '../components/lead-detail/ActivityComposer';
import Timeline from '../components/lead-detail/Timeline';
import DealCard from '../components/lead-detail/DealCard';
import DetailsCard from '../components/lead-detail/DetailsCard';
import TagsCard from '../components/lead-detail/TagsCard';
import FollowUpsCard from '../components/lead-detail/FollowUpsCard';
import NotesCard from '../components/lead-detail/NotesCard';
import { formatShort } from '../components/lead-detail/helpers';
import { apiError, formatRelative, isOverdue, mapsLink, phoneLink, sourceLabel, stageLabel } from '../utils/crm';
import { formatDateTime } from '../utils/format';
import { getInitials } from '../utils/initials';
import '../styles/lead-detail.css';

const asList = (data) => (Array.isArray(data) ? data : data?.items || []);

function LeadDetailSkeleton() {
  return (
    <div className="page ld-page" aria-busy="true">
      <Skeleton width={90} height={14} />
      <div className="ld-header">
        <div className="ld-identity">
          <Skeleton width={48} height={48} radius={14} />
          <div className="ld-skel-stack">
            <Skeleton width={240} height={24} />
            <Skeleton width={180} height={14} />
            <Skeleton width={300} height={14} />
          </div>
        </div>
      </div>
      <Skeleton height={62} radius={14} />
      <div className="ld-layout">
        <div className="ld-main">
          <Skeleton height={190} radius={14} />
          <Skeleton height={360} radius={14} />
        </div>
        <div className="ld-side">
          <Skeleton height={170} radius={14} />
          <Skeleton height={320} radius={14} />
          <Skeleton height={110} radius={14} />
        </div>
      </div>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { settings } = useAppSettings();
  const { tags: allTags } = useTags();

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const composerRef = useRef(null);
  const requestRef = useRef(0);
  const leadRef = useRef(null);
  leadRef.current = lead;

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const req = ++requestRef.current;
      if (!silent) setLoading(true);
      const [leadRes, tlRes, remRes, apRes] = await Promise.allSettled([
        api.get(`/leads/${id}`),
        api.get(`/leads/${id}/timeline`),
        api.get('/reminders', { params: { lead_id: id, completed: false } }),
        api.get('/appointments', { params: { lead_id: id } }),
      ]);
      if (req !== requestRef.current) return;

      if (leadRes.status === 'rejected') {
        const status = leadRes.reason?.response?.status;
        if (!silent || status === 403 || status === 404) {
          setError({ status, message: apiError(leadRes.reason, 'Could not load this lead') });
          setLead(null);
        } else {
          toast.error(apiError(leadRes.reason, 'Could not refresh this lead'));
        }
        setLoading(false);
        return;
      }

      setError(null);
      setLead(leadRes.value.data);
      if (tlRes.status === 'fulfilled') setTimeline(tlRes.value.data?.items || []);
      if (remRes.status === 'fulfilled') setReminders(asList(remRes.value.data).filter((r) => !r.is_completed));
      if (apRes.status === 'fulfilled') {
        setAppointments(asList(apRes.value.data).filter((a) => a.status === 'scheduled'));
      }
      setLoading(false);
    },
    [id]
  );

  useEffect(() => {
    setLead(null);
    setTimeline([]);
    setReminders([]);
    setAppointments([]);
    setModal(null);
    load();
  }, [load]);

  const reload = useCallback(() => load({ silent: true }), [load]);

  /** PUT /leads/:id with optimistic merge and rollback. Resolves true on success. */
  const updateLead = useCallback(
    async (body, successMessage, optimistic = {}) => {
      const previous = leadRef.current;
      if (!previous) return false;
      const { status_note: _note, tag_ids: _tags, ...visible } = body;
      setLead({ ...previous, ...visible, ...optimistic });
      try {
        await api.put(`/leads/${previous.id}`, body);
        if (successMessage) toast.success(successMessage);
        reload();
        return true;
      } catch (err) {
        setLead((current) => (current && current.id === previous.id ? previous : current));
        toast.error(apiError(err, 'Could not update lead'));
        return false;
      }
    },
    [reload]
  );

  const runAction = async (fn, successMessage, key) => {
    if (key) setBusyId(key);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      await reload();
      return true;
    } catch (err) {
      toast.error(apiError(err));
      return false;
    } finally {
      if (key) setBusyId(null);
    }
  };

  // --- Stage changes ---
  const selectStage = (next) => {
    if (!lead || next === lead.status) return;
    if (next === 'lost') return setModal('lost');
    if (next === 'won') return setModal('won');
    return updateLead({ status: next }, `Moved to ${stageLabel(next)}`);
  };

  const submitStageModal = async (body) => {
    setSaving(true);
    const ok = await updateLead(body, `Marked as ${stageLabel(body.status)}`);
    setSaving(false);
    if (ok) setModal(null);
  };

  // --- Activities & follow-ups ---
  const logActivity = async (payload) => {
    setSaving(true);
    const ok = await runAction(() => api.post('/activities', { lead_id: lead.id, ...payload }), 'Activity logged');
    setSaving(false);
    if (ok && payload.outcome === 'Call back later') setModal('callback');
    return ok;
  };

  const createReminder = async (body) => {
    setSaving(true);
    const ok = await runAction(() => api.post('/reminders', body), 'Callback scheduled');
    setSaving(false);
    if (ok) setModal(null);
  };

  const createAppointment = async (body) => {
    setSaving(true);
    const ok = await runAction(() => api.post('/appointments', body), 'Appointment booked');
    setSaving(false);
    if (ok) setModal(null);
  };

  const completeReminder = (reminderId) =>
    runAction(() => api.post(`/reminders/${reminderId}/complete`, {}), 'Follow-up completed', `r${reminderId}`);

  const snoozeReminder = (reminder, minutes) =>
    runAction(
      () => api.post(`/reminders/${reminder.id}/snooze`, { minutes }),
      'Follow-up snoozed',
      `r${reminder.id}`
    );

  const setAppointmentStatus = (appointment, status) =>
    runAction(
      () => api.put(`/appointments/${appointment.id}`, { status }),
      status === 'completed' ? 'Appointment completed' : status === 'no_show' ? 'Marked as no-show' : 'Appointment cancelled',
      `p${appointment.id}`
    );

  const confirmDeleteActivity = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const ok = await runAction(() => api.delete(`/activities/${deleteTarget.ref_id}`), 'Activity deleted');
    setSaving(false);
    if (ok) setDeleteTarget(null);
  };

  // --- Record-level actions ---
  const saveTags = (ids, message) => {
    const known = [...(lead?.tags || []), ...allTags];
    const tags = ids.map((tagId) => known.find((t) => t.id === tagId)).filter(Boolean);
    return updateLead({ tag_ids: ids }, message, { tags });
  };

  const archiveLead = async () => {
    setSaving(true);
    try {
      await api.delete(`/leads/${lead.id}`);
      toast.success('Lead archived');
      setModal(null);
      navigate('/leads');
    } catch (err) {
      toast.error(apiError(err, 'Could not archive lead'));
    } finally {
      setSaving(false);
    }
  };

  const restoreLead = () => runAction(() => api.post(`/leads/${lead.id}/restore`), 'Lead restored', 'restore');

  const focusComposer = () => {
    const el = composerRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), 250);
  };

  // --- Render ---
  if (loading && !lead) return <LeadDetailSkeleton />;

  if (error || !lead) {
    const forbidden = error?.status === 403;
    const missing = error?.status === 404;
    return (
      <div className="page ld-page">
        <Link to="/leads" className="ld-back">
          <FiArrowLeft size={14} /> Leads
        </Link>
        <div className="panel ld-state">
          <EmptyState
            icon={forbidden ? FiLock : missing ? FiSearch : FiAlertCircle}
            title={forbidden ? 'You don’t have access to this lead' : missing ? 'Lead not found' : 'Couldn’t load this lead'}
            action={
              <div className="ld-actions">
                <Link to="/leads" className="btn primary">
                  <FiArrowLeft size={14} /> Back to leads
                </Link>
                {!forbidden && !missing ? (
                  <button type="button" className="btn" onClick={() => load()}>
                    Try again
                  </button>
                ) : null}
              </div>
            }
          >
            {forbidden
              ? 'It’s assigned to someone else. Ask an admin to reassign it if you need to work on it.'
              : missing
                ? 'It may have been removed, or the link is wrong.'
                : error?.message}
          </EmptyState>
        </div>
      </div>
    );
  }

  const readOnly = Boolean(lead.archived_at);
  const links = phoneLink(lead.phone);
  const mapHref = mapsLink(lead);
  const currency = settings.currency || 'INR';
  const subtitle = [lead.company, lead.address].filter(Boolean).join(' · ');
  const callbackOverdue = lead.next_callback && isOverdue(lead.next_callback);

  return (
    <div className="page ld-page">
      <Link to="/leads" className="ld-back">
        <FiArrowLeft size={14} /> Leads
      </Link>

      <header className="ld-header">
        <div className="ld-identity">
          <span className="ld-avatar" aria-hidden="true">
            {getInitials(lead.name)}
          </span>
          <div className="ld-identity-text">
            <div className="ld-title-row">
              <h1>{lead.name}</h1>
              <StageBadge status={lead.status} />
              {lead.temperature ? <TemperatureBadge temperature={lead.temperature} score={lead.score} /> : null}
            </div>
            {subtitle ? <p className="ld-subtitle">{subtitle}</p> : null}
            <div className="ld-meta">
              <span>
                <FiUser size={13} /> <strong>{lead.assigned_name || 'Unassigned'}</strong>
              </span>
              {lead.product_name ? (
                <span>
                  <FiBox size={13} /> {lead.product_name}
                </span>
              ) : null}
              <span>
                <FiCompass size={13} /> {sourceLabel(lead.source)}
              </span>
              {lead.next_callback ? (
                <span className={callbackOverdue ? 'is-overdue' : ''} title={formatDateTime(lead.next_callback)}>
                  <FiBell size={13} /> {callbackOverdue ? 'Callback overdue' : 'Next callback'}{' '}
                  <strong>{formatShort(lead.next_callback)}</strong>
                </span>
              ) : null}
              {lead.last_activity_at ? (
                <span title={formatDateTime(lead.last_activity_at)}>Active {formatRelative(lead.last_activity_at)}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="ld-header-side">
          <ScoreRing score={lead.score} size={46} />
          <RefreshButton onRefresh={reload} />
        </div>
      </header>

      {lead.archived_at ? (
        <div className="ld-banner" role="status">
          {lead.merged_into ? <FiGitMerge size={16} /> : <FiArchive size={16} />}
          <p>
            {lead.merged_into ? (
              <>
                Merged into <Link to={`/leads/${lead.merged_into}`}>another lead</Link> and archived{' '}
                {formatRelative(lead.archived_at)}. Continue work on the primary record.
              </>
            ) : (
              <>This lead was archived {formatRelative(lead.archived_at)}. It’s hidden from lists and can’t take new activity.</>
            )}
          </p>
          {isAdmin ? (
            <button type="button" className="btn small" onClick={restoreLead} disabled={busyId === 'restore'}>
              <FiRotateCcw size={13} /> Restore
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="panel ld-stage-panel" aria-label="Pipeline stage">
        <StageStepper status={lead.status} onSelect={selectStage} disabled={readOnly} />
      </section>

      <div className="ld-actions" aria-label="Quick actions">
        {links ? (
          <a className="btn" href={links.tel}>
            <FiPhone size={14} /> Call
          </a>
        ) : (
          <span className="btn is-disabled" aria-disabled="true" title="No phone number">
            <FiPhone size={14} /> Call
          </span>
        )}
        {links ? (
          <a className="btn ld-btn-whatsapp" href={links.whatsapp} target="_blank" rel="noopener noreferrer">
            <FiMessageCircle size={14} /> WhatsApp
          </a>
        ) : (
          <span className="btn is-disabled" aria-disabled="true" title="No phone number">
            <FiMessageCircle size={14} /> WhatsApp
          </span>
        )}
        {mapHref ? (
          <a className="btn ld-btn-map" href={mapHref} target="_blank" rel="noopener noreferrer">
            <FiMapPin size={14} /> Google Maps
          </a>
        ) : (
          <span className="btn is-disabled" aria-disabled="true" title="No address or map link">
            <FiMapPin size={14} /> Google Maps
          </span>
        )}
        {lead.email ? (
          <a className="btn" href={`mailto:${lead.email}`}>
            <FiMail size={14} /> Email
          </a>
        ) : (
          <span className="btn is-disabled" aria-disabled="true" title="No email address">
            <FiMail size={14} /> Email
          </span>
        )}
        <button type="button" className="btn" onClick={focusComposer} disabled={readOnly}>
          <FiEdit3 size={14} /> Log activity
        </button>
        <button type="button" className="btn" onClick={() => setModal('callback')} disabled={readOnly}>
          <FiBell size={14} /> Schedule callback
        </button>
        <button type="button" className="btn" onClick={() => setModal('appointment')} disabled={readOnly}>
          <FiCalendar size={14} /> Book appointment
        </button>
        {isAdmin && !readOnly ? (
          <>
            <span className="ld-actions-spacer" />
            <button type="button" className="btn ghost ld-btn-danger-ghost" onClick={() => setModal('archive')}>
              <FiArchive size={14} /> Archive
            </button>
          </>
        ) : null}
      </div>

      <div className="ld-layout">
        <div className="ld-main">
          <ActivityComposer disabled={readOnly} saving={saving} onSubmit={logActivity} inputRef={composerRef} />
          <Timeline
            items={timeline}
            loading={loading}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            busyId={busyId}
            onDeleteActivity={setDeleteTarget}
            onCompleteReminder={(item) => completeReminder(item.ref_id)}
          />
        </div>

        <aside className="ld-side" aria-label="Lead details">
          <DealCard
            lead={lead}
            currency={currency}
            lostReasons={settings.lost_reasons}
            readOnly={readOnly}
            onSave={updateLead}
          />
          <FollowUpsCard
            reminders={reminders}
            appointments={appointments}
            readOnly={readOnly}
            busyId={busyId}
            onAddCallback={() => setModal('callback')}
            onCompleteReminder={(r) => completeReminder(r.id)}
            onSnoozeReminder={snoozeReminder}
            onAppointmentStatus={setAppointmentStatus}
          />
          <DetailsCard
            lead={lead}
            isAdmin={isAdmin}
            sources={settings.lead_sources}
            readOnly={readOnly}
            onSave={updateLead}
          />
          <TagsCard lead={lead} readOnly={readOnly} onSaveTags={saveTags} />
          <NotesCard notes={lead.notes} readOnly={readOnly} onSave={updateLead} />
        </aside>
      </div>

      <LostReasonModal
        open={modal === 'lost'}
        reasons={settings.lost_reasons}
        initialReason={lead.lost_reason}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={(data) => submitStageModal({ status: 'lost', ...data })}
      />
      <WonModal
        open={modal === 'won'}
        dealValue={lead.deal_value}
        currency={currency}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={(data) => submitStageModal({ status: 'won', ...data })}
      />
      <CallbackModal
        open={modal === 'callback'}
        lead={lead}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={createReminder}
      />
      <AppointmentModal
        open={modal === 'appointment'}
        lead={lead}
        isAdmin={isAdmin}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={createAppointment}
      />
      <ConfirmModal
        open={modal === 'archive'}
        title="Archive lead"
        message={`Archive “${lead.name}”? It will be hidden from lists and reports. Admins can restore it later; nothing is deleted.`}
        confirmLabel="Archive lead"
        loading={saving}
        onConfirm={archiveLead}
        onClose={() => setModal(null)}
      />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete activity"
        message="Delete this activity from the timeline? This cannot be undone."
        confirmLabel="Delete"
        loading={saving}
        onConfirm={confirmDeleteActivity}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
