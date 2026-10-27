import { APP_TIMEZONE, formatDateTime, parseAppDate } from '../../utils/format';

function istParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: get('hour'),
    min: get('minute'),
  };
}

/** India wall-clock `YYYY-MM-DDTHH:mm` (the DateTimePicker value format). */
export function toPickerValue(value) {
  const date = parseAppDate(value);
  if (!date) return '';
  const p = istParts(date);
  return `${p.y}-${p.m}-${p.d}T${p.h}:${p.min}`;
}

/** India calendar date `YYYY-MM-DD` for any API date/datetime value. */
export function toDateValue(value) {
  const date = parseAppDate(value);
  if (!date) return '';
  const p = istParts(date);
  return `${p.y}-${p.m}-${p.d}`;
}

/** Picker value → API datetime (`YYYY-MM-DD HH:mm`). */
export const toApiDateTime = (value) => (value ? String(value).replace('T', ' ') : null);

/** Picker value for "now + minutes", rounded up to the next 5 minutes. */
export function pickerFromNow(minutes) {
  const ms = Date.now() + minutes * 60000;
  const rounded = Math.ceil(ms / 300000) * 300000;
  return toPickerValue(new Date(rounded));
}

/** Picker value for N days from today (India) at a fixed hour. */
export function pickerDaysAt(days, hour = 10) {
  const today = toDateValue(new Date());
  const base = new Date(`${today}T00:00:00+05:30`);
  base.setTime(base.getTime() + days * 86400000);
  return `${toDateValue(base)}T${String(hour).padStart(2, '0')}:00`;
}

export function dayLabel(dayKey) {
  if (!dayKey) return 'Unknown date';
  const today = toDateValue(new Date());
  const yesterday = toDateValue(new Date(Date.now() - 86400000));
  if (dayKey === today) return 'Today';
  if (dayKey === yesterday) return 'Yesterday';
  return formatDateTime(dayKey, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const formatTime = (value) => formatDateTime(value, { hour: '2-digit', minute: '2-digit' });

export const formatShort = (value) =>
  formatDateTime(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatDateOnly = (value) =>
  value ? formatDateTime(toDateValue(value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Whole days from today (India) to a date value; negative when past. */
export function daysUntil(value) {
  const key = toDateValue(value);
  if (!key) return null;
  const today = new Date(`${toDateValue(new Date())}T00:00:00+05:30`).getTime();
  const target = new Date(`${key}T00:00:00+05:30`).getTime();
  return Math.round((target - today) / 86400000);
}

export function formatDuration(seconds) {
  const s = Number(seconds) || 0;
  if (!s) return '';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
}

export const PLATFORM_OPTIONS = [
  { value: 'call', label: 'Phone call' },
  { value: 'meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Teams' },
  { value: 'in_person', label: 'In person' },
  { value: 'other', label: 'Other' },
];

export const platformLabel = (value) => PLATFORM_OPTIONS.find((p) => p.value === value)?.label || value || '—';

export const CALL_OUTCOMES = ['Connected', 'No answer', 'Busy', 'Call back later', 'Interested', 'Not interested'];

export const SNOOZE_OPTIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 1440, label: 'Tomorrow' },
  { minutes: 4320, label: '3 days' },
];
