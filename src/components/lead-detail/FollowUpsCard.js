import React from 'react';
import { FiBell, FiCalendar, FiCheck, FiClock, FiPlus, FiUserX, FiXCircle } from 'react-icons/fi';
import ActionMenu from '../ActionMenu';
import { formatRelative, isOverdue } from '../../utils/crm';
import { formatDateTime } from '../../utils/format';
import { formatShort, platformLabel, SNOOZE_OPTIONS } from './helpers';
import { SideCard } from './DealCard';

/** Open callbacks and scheduled appointments for this lead. */
export default function FollowUpsCard({
  reminders = [],
  appointments = [],
  readOnly,
  busyId,
  onAddCallback,
  onCompleteReminder,
  onSnoozeReminder,
  onAppointmentStatus,
}) {
  const items = [
    ...reminders.map((r) => ({ kind: 'reminder', key: `r${r.id}`, at: r.remind_at, row: r })),
    ...appointments.map((a) => ({ kind: 'appointment', key: `p${a.id}`, at: a.start_at, row: a })),
  ].sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return (
    <SideCard
      title="Upcoming follow-ups"
      icon={FiClock}
      action={
        !readOnly ? (
          <button type="button" className="btn ghost small ld-card-edit" onClick={onAddCallback}>
            <FiPlus size={12} />
            Callback
          </button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="ld-card-empty">Nothing scheduled. Plan the next step so this lead doesn’t go cold.</p>
      ) : (
        <ul className="ld-followups">
          {items.map((item) => {
            const overdue = isOverdue(item.at);
            const busy = busyId === item.key;
            if (item.kind === 'reminder') {
              const r = item.row;
              return (
                <li key={item.key} className={`ld-fu ${overdue ? 'is-overdue' : ''}`}>
                  <span className={`ld-fu-icon tone-${overdue ? 'rose' : 'amber'}`}>
                    <FiBell size={13} />
                  </span>
                  <div className="ld-fu-main">
                    <strong>{r.title || 'Callback'}</strong>
                    <span className="ld-fu-when" title={formatDateTime(r.remind_at)}>
                      {overdue ? 'Overdue · ' : ''}
                      {formatShort(r.remind_at)} · {formatRelative(r.remind_at)}
                    </span>
                    {r.priority === 'high' || r.user_name ? (
                      <span className="ld-fu-meta">
                        {r.priority === 'high' ? <span className="ld-priority ld-priority-high">High</span> : null}
                        {r.user_name ? <span>{r.user_name}</span> : null}
                      </span>
                    ) : null}
                  </div>
                  <div className="ld-fu-actions">
                    <button
                      type="button"
                      className="icon-btn ld-icon-sm"
                      title="Mark complete"
                      aria-label="Mark complete"
                      disabled={busy}
                      onClick={() => onCompleteReminder(r)}
                    >
                      <FiCheck size={14} />
                    </button>
                    <ActionMenu
                      items={SNOOZE_OPTIONS.map((o) => ({
                        label: `Snooze ${o.label.toLowerCase()}`,
                        icon: <FiClock size={14} />,
                        onClick: () => onSnoozeReminder(r, o.minutes),
                      }))}
                    />
                  </div>
                </li>
              );
            }
            const a = item.row;
            return (
              <li key={item.key} className="ld-fu">
                <span className="ld-fu-icon tone-teal">
                  <FiCalendar size={13} />
                </span>
                <div className="ld-fu-main">
                  <strong>{a.title || 'Appointment'}</strong>
                  <span className="ld-fu-when" title={formatDateTime(a.start_at)}>
                    {formatShort(a.start_at)} · {platformLabel(a.platform)}
                  </span>
                  {a.assigned_name || a.location ? (
                    <span className="ld-fu-meta">
                      {a.assigned_name ? <span>{a.assigned_name}</span> : null}
                      {a.location ? <span className="ld-fu-loc">{a.location}</span> : null}
                    </span>
                  ) : null}
                </div>
                <div className="ld-fu-actions">
                  <button
                    type="button"
                    className="icon-btn ld-icon-sm"
                    title="Mark completed"
                    aria-label="Mark appointment completed"
                    disabled={busy}
                    onClick={() => onAppointmentStatus(a, 'completed')}
                  >
                    <FiCheck size={14} />
                  </button>
                  <ActionMenu
                    items={[
                      { label: 'Mark no-show', icon: <FiUserX size={14} />, onClick: () => onAppointmentStatus(a, 'no_show') },
                      { label: 'Cancel appointment', icon: <FiXCircle size={14} />, danger: true, onClick: () => onAppointmentStatus(a, 'cancelled') },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}
