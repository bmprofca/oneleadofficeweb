import React from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiPhoneCall } from 'react-icons/fi';
import ActionMenu from '../ActionMenu';
import { TagList, TemperatureBadge } from '../crm/Badges';
import { formatDateTime, parseAppDate } from '../../utils/format';
import { formatCurrency, formatRelative, isOverdue, mapsLink, OPEN_STAGES, STAGE_HEX, stageLabel } from '../../utils/crm';
import ContactLinks from '../crm/ContactLinks';
import { getInitials } from '../../utils/initials';

const DAY = 24 * 60 * 60 * 1000;

function daysInStage(value) {
  const date = parseAppDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY));
}

/** One deal on the pipeline board. Draggable, with a "Move to…" menu fallback. */
export default function PipelineCard({ lead, stages, dragging, onDragStart, onDragEnd, onMove }) {
  const days = daysInStage(lead.stage_changed_at);
  const stale = days !== null && days >= 14 && OPEN_STAGES.includes(lead.status);
  const overdue = lead.next_callback && isOverdue(lead.next_callback);

  const moveItems = stages
    .filter((key) => key !== lead.status)
    .map((key) => ({
      label: `Move to ${stageLabel(key)}`,
      icon: <span className="pl-menu-dot" style={{ background: STAGE_HEX[key] }} aria-hidden="true" />,
      onClick: () => onMove(lead, key),
    }));

  return (
    <article
      className={`pl-card${dragging ? ' is-dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      aria-label={`${lead.name}, ${stageLabel(lead.status)}`}
    >
      <div className="pl-card-top">
        <Link to={`/leads/${encodeURIComponent(lead.id)}`} className="pl-card-name" draggable={false} title={lead.name}>
          {lead.name}
        </Link>
        <div className="pl-card-menu">
          <ActionMenu items={moveItems} />
        </div>
      </div>

      {lead.product_name ? <div className="pl-card-product">{lead.product_name}</div> : null}

      <div className="pl-card-row">
        <span className={`pl-card-value${lead.deal_value ? '' : ' is-empty'}`}>
          {lead.deal_value ? formatCurrency(lead.deal_value) : 'No value'}
        </span>
        {lead.temperature ? <TemperatureBadge temperature={lead.temperature} score={lead.score} /> : null}
      </div>

      {lead.next_callback ? (
        <div className={`pl-card-callback${overdue ? ' is-overdue' : ''}`} title={formatDateTime(lead.next_callback)}>
          <FiPhoneCall size={12} aria-hidden="true" />
          <span>
            {overdue ? 'Overdue · ' : 'Callback '}
            {formatRelative(lead.next_callback)}
          </span>
        </div>
      ) : null}

      {lead.tags?.length ? (
        <div className="pl-card-tags">
          <TagList tags={lead.tags} max={2} />
        </div>
      ) : null}

      <div className="pl-card-foot">
        <span
          className={`pl-card-age${stale ? ' is-stale' : ''}`}
          title={lead.stage_changed_at ? `In ${stageLabel(lead.status)} since ${formatDateTime(lead.stage_changed_at)}` : undefined}
        >
          <FiClock size={12} aria-hidden="true" />
          {days === null ? '—' : days === 0 ? '<1d in stage' : `${days}d in stage`}
        </span>
        <ContactLinks className="pl-card-contact" phone={lead.phone} name={lead.name} map={mapsLink(lead)} whatsapp={false} />
        <span
          className={`pl-avatar${lead.assigned_name ? '' : ' is-empty'}`}
          title={lead.assigned_name ? `Owner: ${lead.assigned_name}` : 'Unassigned'}
        >
          {lead.assigned_name ? getInitials(lead.assigned_name) : '?'}
        </span>
      </div>
    </article>
  );
}
