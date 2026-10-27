import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiMapPin, FiMessageCircle, FiPhone, FiUser } from 'react-icons/fi';
import SnoozeMenu from './SnoozeMenu';
import { formatDateTime } from '../../utils/format';
import { formatRelative, mapsLink, phoneLink } from '../../utils/crm';
import { timeOf } from './time';

const PRIORITY_LABEL = { high: 'High priority', normal: 'Normal priority', low: 'Low priority' };

/** One callback row on My day. `variant`: overdue | today | upcoming | done. */
export default function TaskRow({ task, variant, showOwner, busy, onComplete, onSnooze }) {
  const priority = task.priority || 'normal';
  const links = phoneLink(task.lead_phone);
  const mapHref = mapsLink(task, 'lead_');
  const done = variant === 'done';
  const leadHref = task.lead_id ? `/leads/${encodeURIComponent(task.lead_id)}` : null;
  const when = done ? task.completed_at : task.remind_at;
  const timeText =
    variant === 'upcoming' ? timeOf(task.remind_at) : done ? `Done ${formatRelative(task.completed_at)}` : formatRelative(task.remind_at);

  return (
    <li className={`md-row md-row-${variant} md-priority-${priority}${busy ? ' is-busy' : ''}`}>
      <span className="md-priority" title={PRIORITY_LABEL[priority] || priority} aria-label={PRIORITY_LABEL[priority]} />

      <div className="md-row-main">
        <div className="md-row-title">
          {done ? (
            <span className="md-done-check" aria-hidden="true">
              <FiCheck size={11} />
            </span>
          ) : null}
          <strong title={task.title}>{task.title}</strong>
          {priority === 'high' && !done ? <span className="md-flag">High</span> : null}
        </div>
        <div className="md-row-meta">
          {leadHref ? (
            <Link to={leadHref} className="md-lead-link">
              {task.lead_name || 'Lead'}
            </Link>
          ) : (
            <span>{task.lead_name || '—'}</span>
          )}
          {task.product_name ? <span className="md-meta-item">{task.product_name}</span> : null}
          {task.lead_phone ? <span className="md-meta-item md-phone">{task.lead_phone}</span> : null}
          {showOwner && (task.lead_assigned_name || task.user_name) ? (
            <span className="md-meta-item md-owner" title="Assigned salesperson">
              <FiUser size={11} aria-hidden="true" />
              {task.lead_assigned_name || task.user_name}
            </span>
          ) : null}
        </div>
        {task.description && !done ? <p className="md-row-desc">{task.description}</p> : null}
      </div>

      <div className="md-row-side">
        <span className={`md-due md-due-${variant}`} title={formatDateTime(when)}>
          {timeText}
        </span>
        {!done ? (
          <div className="md-row-actions">
            {links ? (
              <>
                <a href={links.tel} className="icon-btn md-icon-btn" title={`Call ${task.lead_phone}`} aria-label={`Call ${task.lead_name || task.lead_phone}`}>
                  <FiPhone size={14} />
                </a>
                <a
                  href={links.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-btn md-icon-btn md-wa"
                  title="WhatsApp"
                  aria-label={`WhatsApp ${task.lead_name || task.lead_phone}`}
                >
                  <FiMessageCircle size={14} />
                </a>
              </>
            ) : null}
            {mapHref ? (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="icon-btn md-icon-btn md-map"
                title="Open on Google Maps"
                aria-label={`Open ${task.lead_name || 'lead'} on Google Maps`}
              >
                <FiMapPin size={14} />
              </a>
            ) : null}
            <SnoozeMenu disabled={busy} onSnooze={(payload, label) => onSnooze(task, payload, label)} />
            <button type="button" className="btn small primary md-complete-btn" onClick={() => onComplete(task)} disabled={busy}>
              <FiCheck size={13} />
              <span>Complete</span>
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
