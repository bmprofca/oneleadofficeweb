import React, { useMemo, useState } from 'react';
import {
  FiArchive,
  FiArrowRight,
  FiBell,
  FiCalendar,
  FiCheck,
  FiClock,
  FiFileText,
  FiGitMerge,
  FiMail,
  FiMessageCircle,
  FiMessageSquare,
  FiPhone,
  FiPhoneIncoming,
  FiPlusCircle,
  FiRotateCcw,
  FiTrash2,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiActivity,
} from 'react-icons/fi';
import ActionMenu from '../ActionMenu';
import { EmptyState, StageBadge } from '../crm/Badges';
import { activityLabel, formatRelative, isOverdue } from '../../utils/crm';
import { formatDateTime, formatOptionLabel } from '../../utils/format';
import { dayLabel, formatDuration, formatShort, formatTime, platformLabel, toDateValue } from './helpers';

const TYPE_ICONS = {
  call: FiPhone,
  whatsapp: FiMessageCircle,
  email: FiMail,
  meeting: FiUsers,
  message: FiMessageSquare,
  note: FiFileText,
};

const SYSTEM_ICONS = {
  create: FiPlusCircle,
  assign: FiUserCheck,
  archive: FiArchive,
  restore: FiRotateCcw,
  merge: FiGitMerge,
};

export function ActivityIcon({ type, direction, size = 15 }) {
  const Icon = type === 'call' && direction === 'inbound' ? FiPhoneIncoming : TYPE_ICONS[type] || FiActivity;
  return <Icon size={size} />;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'activities', label: 'Activities', match: (i) => i.kind === 'activity' },
  { key: 'stages', label: 'Stage changes', match: (i) => i.kind === 'status' },
  { key: 'followups', label: 'Follow-ups', match: (i) => i.kind === 'reminder' },
  {
    key: 'meetings',
    label: 'Meetings',
    match: (i) => i.kind === 'appointment' || (i.kind === 'activity' && i.type === 'meeting'),
  },
];

const KIND_TONE = {
  activity: 'indigo',
  status: 'violet',
  reminder: 'amber',
  appointment: 'teal',
  system: 'slate',
};

const ACTIVITY_TONE = {
  call: 'blue',
  whatsapp: 'emerald',
  email: 'sky',
  meeting: 'teal',
  message: 'cyan',
  note: 'slate',
};

function When({ at }) {
  return (
    <time className="ld-when" dateTime={String(at || '')} title={formatDateTime(at)}>
      {formatRelative(at)}
    </time>
  );
}

function ItemIcon({ item }) {
  let Icon = FiActivity;
  let tone = KIND_TONE[item.kind] || 'slate';
  if (item.kind === 'activity') {
    return (
      <span className={`ld-tl-icon tone-${ACTIVITY_TONE[item.type] || 'indigo'}`}>
        <ActivityIcon type={item.type} direction={item.direction} />
      </span>
    );
  }
  if (item.kind === 'status') Icon = FiTrendingUp;
  if (item.kind === 'reminder') {
    Icon = item.is_completed ? FiCheck : FiBell;
    if (item.is_completed) tone = 'emerald';
  }
  if (item.kind === 'appointment') Icon = FiCalendar;
  if (item.kind === 'system') Icon = SYSTEM_ICONS[item.action] || FiActivity;
  return (
    <span className={`ld-tl-icon tone-${tone}`}>
      <Icon size={15} />
    </span>
  );
}

function ItemBody({ item, onCompleteReminder, busyId }) {
  switch (item.kind) {
    case 'activity': {
      const duration = formatDuration(item.duration_seconds);
      return (
        <>
          <div className="ld-tl-title">
            <strong>{activityLabel(item.type)}</strong>
            {item.type !== 'note' && item.direction ? (
              <span className="ld-tl-muted">{item.direction === 'inbound' ? 'Incoming' : 'Outgoing'}</span>
            ) : null}
            {item.outcome ? <span className="ld-outcome-pill">{item.outcome}</span> : null}
            {duration ? (
              <span className="ld-tl-muted">
                <FiClock size={11} /> {duration}
              </span>
            ) : null}
          </div>
          {item.subject ? <div className="ld-tl-subject">{item.subject}</div> : null}
          {item.content ? <p className="ld-tl-content">{item.content}</p> : null}
        </>
      );
    }
    case 'status':
      return (
        <>
          <div className="ld-tl-title">
            <strong>Stage changed</strong>
            {item.from_status ? (
              <>
                <StageBadge status={item.from_status} />
                <FiArrowRight size={12} className="ld-tl-arrow" aria-label="to" />
              </>
            ) : null}
            <StageBadge status={item.to_status} />
          </div>
          {item.note ? <p className="ld-tl-content">{item.note}</p> : null}
        </>
      );
    case 'reminder': {
      const overdue = !item.is_completed && isOverdue(item.due_at);
      return (
        <>
          <div className="ld-tl-title">
            <strong>{item.is_completed ? 'Follow-up completed' : 'Follow-up scheduled'}</strong>
            {item.priority === 'high' ? <span className="ld-priority ld-priority-high">High</span> : null}
          </div>
          <div className="ld-tl-subject">{item.title}</div>
          <div className={`ld-tl-due ${overdue ? 'is-overdue' : ''}`}>
            <FiClock size={12} />
            {item.is_completed ? 'Was due ' : overdue ? 'Overdue · due ' : 'Due '}
            <span title={formatDateTime(item.due_at)}>{formatShort(item.due_at)}</span>
            {!item.is_completed ? (
              <button
                type="button"
                className="btn small ld-tl-action"
                onClick={() => onCompleteReminder(item)}
                disabled={busyId === item.id}
              >
                <FiCheck size={12} /> Complete
              </button>
            ) : null}
          </div>
          {item.description ? <p className="ld-tl-content">{item.description}</p> : null}
        </>
      );
    }
    case 'appointment':
      return (
        <>
          <div className="ld-tl-title">
            <strong>Appointment</strong>
            <span className={`status status-${item.status}`}>{formatOptionLabel(item.status)}</span>
          </div>
          <div className="ld-tl-subject">{item.title}</div>
          <div className="ld-tl-due">
            <FiCalendar size={12} />
            <span title={formatDateTime(item.start_at)}>{formatShort(item.start_at)}</span>
            <span className="ld-tl-muted">· {platformLabel(item.platform)}</span>
          </div>
          {item.location ? <p className="ld-tl-content">{item.location}</p> : null}
        </>
      );
    case 'system':
    default:
      return (
        <div className="ld-tl-title">
          <span className="ld-tl-system">{item.summary || formatOptionLabel(item.action)}</span>
        </div>
      );
  }
}

/** Unified, filterable lead timeline grouped by day. */
export default function Timeline({ items = [], loading, currentUserId, isAdmin, onDeleteActivity, onCompleteReminder, busyId }) {
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = {};
    FILTERS.forEach((f) => {
      c[f.key] = f.match ? items.filter(f.match).length : items.length;
    });
    return c;
  }, [items]);

  const groups = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    const list = active?.match ? items.filter(active.match) : items;
    const out = [];
    list.forEach((item) => {
      const key = toDateValue(item.at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(item);
      else out.push({ key, items: [item] });
    });
    return out;
  }, [items, filter]);

  return (
    <section className="panel ld-timeline" aria-label="Timeline">
      <div className="panel-header ld-timeline-header">
        <div>
          <h2>Timeline</h2>
          <p className="panel-subtitle">Everything that happened with this lead</p>
        </div>
      </div>
      <div className="ld-filter-chips" role="tablist" aria-label="Filter timeline">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`ld-chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ld-chip-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {loading && !items.length ? (
        <div className="ld-tl-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ld-tl-skel">
              <span className="skeleton" style={{ width: 30, height: 30, borderRadius: 10 }} />
              <div>
                <span className="skeleton" style={{ width: '40%', height: 12, borderRadius: 6 }} />
                <span className="skeleton" style={{ width: '75%', height: 12, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={FiActivity} title={filter === 'all' ? 'No activity yet' : 'Nothing here'}>
          {filter === 'all'
            ? 'Log a call, message or note above to start the history for this lead.'
            : 'No timeline entries match this filter.'}
        </EmptyState>
      ) : (
        <div className="ld-tl">
          {groups.map((group) => (
            <div key={group.key || 'unknown'} className="ld-tl-day">
              <div className="ld-tl-day-label">{dayLabel(group.key)}</div>
              <ol className="ld-tl-list">
                {group.items.map((item) => {
                  const canDelete =
                    item.kind === 'activity' && (isAdmin || (currentUserId && item.user_id === currentUserId));
                  return (
                    <li key={item.id} className={`ld-tl-item ld-tl-${item.kind}`}>
                      <ItemIcon item={item} />
                      <div className="ld-tl-main">
                        <ItemBody item={item} onCompleteReminder={onCompleteReminder} busyId={busyId} />
                        <div className="ld-tl-meta">
                          {item.user_name ? <span>{item.user_name}</span> : null}
                          {item.user_name ? <span aria-hidden="true">·</span> : null}
                          <When at={item.at} />
                          <span className="ld-tl-time" title={formatDateTime(item.at)}>
                            {formatTime(item.at)}
                          </span>
                        </div>
                      </div>
                      {canDelete ? (
                        <div className="ld-tl-menu">
                          <ActionMenu
                            items={[
                              {
                                label: 'Delete activity',
                                icon: <FiTrash2 size={14} />,
                                danger: true,
                                onClick: () => onDeleteActivity(item),
                              },
                            ]}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
