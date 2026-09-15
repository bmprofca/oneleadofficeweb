import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiX } from 'react-icons/fi';
import { placeFixedMenu } from '../utils/placeMenu';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n) {
  return String(n).padStart(2, '0');
}

function to12Hour(hour24) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, period };
}

function to24Hour(hour12, period) {
  let h = Number(hour12) % 12;
  if (period === 'PM') h += 12;
  return h;
}

function parseValue(value, mode) {
  if (!value) return { date: null, hour: 9, minute: 0 };
  if (mode === 'time') {
    const [h, m] = String(value).split(':');
    return {
      date: null,
      hour: Number(h) || 0,
      minute: Number(m) || 0,
    };
  }
  const raw = String(value).replace(' ', 'T');
  const [datePart, timePart = '09:00'] = raw.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const date = y && mo && d ? new Date(y, mo - 1, d) : null;
  return {
    date,
    hour: Number.isFinite(h) ? h : 9,
    minute: Number.isFinite(mi) ? mi : 0,
  };
}

function formatDisplay(value, mode) {
  if (!value) return '';
  const { date, hour, minute } = parseValue(value, mode);
  const { hour12, period } = to12Hour(hour);
  const time = `${hour12}:${pad(minute)} ${period}`;
  if (mode === 'time') return time;
  if (!date) return '';
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (mode === 'date') return dateLabel;
  return `${dateLabel} · ${time}`;
}

function toOutput(date, hour, minute, mode) {
  if (mode === 'time') return `${pad(hour)}:${pad(minute)}`;
  if (!date) return '';
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  if (mode === 'date') return `${y}-${m}-${d}`;
  return `${y}-${m}-${d}T${pad(hour)}:${pad(minute)}`;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendar(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

export default function DateTimePicker({
  value = '',
  onChange,
  mode = 'datetime',
  placeholder,
  disabled = false,
  required = false,
  clearable = true,
  className = '',
  invalid = false,
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const hourColRef = useRef(null);
  const minuteColRef = useRef(null);
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseValue(value, mode), [value, mode]);
  const [viewDate, setViewDate] = useState(() => parsed.date || new Date());
  const [draftDate, setDraftDate] = useState(parsed.date);
  const [draftHour, setDraftHour] = useState(parsed.hour);
  const [draftMinute, setDraftMinute] = useState(parsed.minute);
  const [pos, setPos] = useState({
    position: 'fixed',
    top: 0,
    left: 0,
    visibility: 'hidden',
  });

  const draft12 = useMemo(() => to12Hour(draftHour), [draftHour]);

  const popSize = useMemo(() => {
    if (mode === 'time') return { width: 280, height: 320 };
    if (mode === 'date') return { width: 300, height: 320 };
    return { width: 460, height: 440 };
  }, [mode]);

  const updatePosition = (measuredHeight) => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = measuredHeight || popRef.current?.offsetHeight || popSize.height;
    const { style } = placeFixedMenu(rect, {
      menuWidth: popSize.width,
      menuHeight: height,
      gap: 6,
    });
    setPos({
      ...style,
      width: popSize.width,
      zIndex: 10060,
      visibility: 'visible',
    });
  };

  useEffect(() => {
    if (!open) return;
    setDraftDate(parsed.date);
    setDraftHour(parsed.hour);
    setDraftMinute(parsed.minute);
    setViewDate(parsed.date || new Date());
  }, [open, parsed.date, parsed.hour, parsed.minute]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(() => {
      updatePosition(popRef.current?.offsetHeight);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, mode, draftDate, draftHour, draftMinute]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || mode === 'date') return undefined;
    const scrollActive = (col, selector) => {
      const el = col?.querySelector(selector);
      if (el && col) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    };
    const frame = requestAnimationFrame(() => {
      scrollActive(hourColRef.current, 'button.active');
      scrollActive(minuteColRef.current, 'button.active');
    });
    return () => cancelAnimationFrame(frame);
  }, [open, draftHour, draftMinute, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = (e) => {
      if (popRef.current?.contains(e.target)) return;
      updatePosition();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || popRef.current?.contains(e.target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const apply = (nextDate = draftDate, nextHour = draftHour, nextMinute = draftMinute) => {
    if (mode !== 'time' && !nextDate) return;
    const out = toOutput(nextDate, nextHour, nextMinute, mode);
    onChange?.(out);
    setOpen(false);
  };

  const setHour12 = (hour12) => {
    const next = to24Hour(hour12, draft12.period);
    setDraftHour(next);
    if (mode === 'time') apply(draftDate, next, draftMinute);
  };

  const setPeriod = (period) => {
    const next = to24Hour(draft12.hour12, period);
    setDraftHour(next);
    if (mode === 'time') apply(draftDate, next, draftMinute);
  };

  const openPicker = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const { style } = placeFixedMenu(rect, {
      menuWidth: popSize.width,
      menuHeight: popSize.height,
      gap: 6,
    });
    setPos({
      ...style,
      width: popSize.width,
      zIndex: 10060,
      visibility: 'hidden',
    });
    setOpen(true);
  };

  const display =
    formatDisplay(value, mode) ||
    placeholder ||
    (mode === 'date'
      ? 'Select date'
      : mode === 'time'
        ? 'Select time'
        : 'Select date & time');

  const days = useMemo(() => buildCalendar(viewDate), [viewDate]);
  const today = new Date();
  const previewTime = `${draft12.hour12}:${pad(draftMinute)} ${draft12.period}`;

  return (
    <div className={`dtp ${disabled ? 'disabled' : ''} ${className}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`dtp-trigger ${open ? 'open' : ''} ${!value ? 'placeholder' : ''} ${
          invalid ? 'invalid' : ''
        }`}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openPicker();
        }}
      >
        <span className="dtp-icon">
          {mode === 'time' ? <FiClock size={15} /> : <FiCalendar size={15} />}
        </span>
        <span className="dtp-value">{display}</span>
        {clearable && value && !disabled && (
          <span
            className="dtp-clear"
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
            }}
          >
            <FiX size={14} />
          </span>
        )}
      </button>

      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="ss-hidden-required"
          value={value || ''}
          onChange={() => {}}
        />
      ) : null}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popRef}
              className={`dtp-pop mode-${mode}`}
              style={pos}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14 }}
            >
              {mode !== 'time' && (
                <div className="dtp-calendar">
                  <div className="dtp-cal-head">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() =>
                        setViewDate(
                          new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
                        )
                      }
                      aria-label="Previous month"
                    >
                      <FiChevronLeft size={16} />
                    </button>
                    <strong>
                      {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                    </strong>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() =>
                        setViewDate(
                          new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
                        )
                      }
                      aria-label="Next month"
                    >
                      <FiChevronRight size={16} />
                    </button>
                  </div>
                  <div className="dtp-weekdays">
                    {WEEKDAYS.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="dtp-days">
                    {days.map((day) => {
                      const outside = day.getMonth() !== viewDate.getMonth();
                      const selected = sameDay(day, draftDate);
                      const isToday = sameDay(day, today);
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          className={`dtp-day ${outside ? 'outside' : ''} ${
                            selected ? 'selected' : ''
                          } ${isToday ? 'today' : ''}`}
                          onClick={() => {
                            setDraftDate(day);
                            if (mode === 'date') apply(day, draftHour, draftMinute);
                          }}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode !== 'date' && (
                <div className="dtp-time">
                  <div className="dtp-time-label">
                    <FiClock size={14} />
                    <span>Time</span>
                    <strong className="dtp-time-preview">{previewTime}</strong>
                  </div>

                  <div className="dtp-period">
                    <button
                      type="button"
                      className={draft12.period === 'AM' ? 'active' : ''}
                      onClick={() => setPeriod('AM')}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      className={draft12.period === 'PM' ? 'active' : ''}
                      onClick={() => setPeriod('PM')}
                    >
                      PM
                    </button>
                  </div>

                  <div className="dtp-time-cols">
                    <div className="dtp-time-col" ref={hourColRef}>
                      <span className="dtp-col-caption">Hour</span>
                      {HOURS_12.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={draft12.hour12 === h ? 'active' : ''}
                          onClick={() => setHour12(h)}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                    <div className="dtp-time-col" ref={minuteColRef}>
                      <span className="dtp-col-caption">Min</span>
                      {MINUTES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={draftMinute === m ? 'active' : ''}
                          onClick={() => {
                            setDraftMinute(m);
                            if (mode === 'time') apply(draftDate, draftHour, m);
                          }}
                        >
                          {pad(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mode === 'datetime' && (
                <div className="dtp-footer">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const now = new Date();
                      setDraftDate(now);
                      setDraftHour(now.getHours());
                      setDraftMinute(Math.floor(now.getMinutes() / 5) * 5);
                      setViewDate(now);
                    }}
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!draftDate}
                    onClick={() => apply()}
                  >
                    Apply
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
