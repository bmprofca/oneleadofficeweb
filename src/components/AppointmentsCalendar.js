import React, { useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { formatOptionLabel, parseAppDate } from '../utils/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function buildCenteredGrid(anchor = new Date()) {
  const today = startOfDay(anchor);
  // Center today: 2 weeks before + today + ~3 weeks after = 5 weeks
  const rangeStart = addDays(today, -14);
  const gridStart = addDays(rangeStart, -rangeStart.getDay());
  const days = [];
  for (let i = 0; i < 35; i += 1) {
    days.push(addDays(gridStart, i));
  }
  return { today, days, gridStart };
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function AppointmentsCalendar({ appointments = [] }) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const { today, days } = useMemo(() => buildCenteredGrid(anchor), [anchor]);

  const byDay = useMemo(() => {
    const map = new Map();
    appointments.forEach((item) => {
      const date = parseAppDate(item.start_at);
      if (!date) return;
      const key = dayKey(startOfDay(date));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...item, _date: date });
    });
    map.forEach((list) => list.sort((a, b) => a._date - b._date));
    return map;
  }, [appointments]);

  const selectedKey = dayKey(anchor);
  const selectedItems = byDay.get(selectedKey) || [];
  const monthLabel = anchor.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <div className="appt-calendar">
      <div className="appt-cal-toolbar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous weeks"
          onClick={() => setAnchor((d) => addDays(d, -7))}
        >
          <FiChevronLeft size={16} />
        </button>
        <div className="appt-cal-heading">
          <strong>{monthLabel}</strong>
          <button
            type="button"
            className="btn small"
            onClick={() => setAnchor(startOfDay(new Date()))}
          >
            Today
          </button>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next weeks"
          onClick={() => setAnchor((d) => addDays(d, 7))}
        >
          <FiChevronRight size={16} />
        </button>
      </div>

      <div className="appt-cal-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="appt-cal-grid">
        {days.map((day) => {
          const key = dayKey(day);
          const items = byDay.get(key) || [];
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, anchor);
          const outsideMonth = day.getMonth() !== anchor.getMonth();
          return (
            <button
              key={key}
              type="button"
              className={`appt-cal-day ${isToday ? 'is-today' : ''} ${
                isSelected ? 'is-selected' : ''
              } ${outsideMonth ? 'is-outside' : ''} ${
                items.length ? 'has-events' : ''
              }`}
              onClick={() => setAnchor(startOfDay(day))}
            >
              <span className="appt-cal-date">{day.getDate()}</span>
              {items.length > 0 && (
                <span className="appt-cal-dots">
                  {items.slice(0, 3).map((item) => (
                    <i key={item.id} className={`dot status-${item.status}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="appt-cal-list">
        <div className="appt-cal-list-head">
          <strong>
            {anchor.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </strong>
          <span>{selectedItems.length} appointment(s)</span>
        </div>
        {selectedItems.length === 0 ? (
          <p className="appt-cal-empty">No appointments on this day.</p>
        ) : (
          <ul>
            {selectedItems.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item._date.toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {item.lead_name ? ` · ${item.lead_name}` : ''}
                  </small>
                </div>
                <span className={`status status-${item.status}`}>
                  {formatOptionLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
