import { APP_TIMEZONE, parseAppDate } from '../../utils/format';

const DAY = 24 * 60 * 60 * 1000;
const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' of a moment, in India time. */
export const istDateKey = (date = new Date()) => ymdFormatter.format(date);

/** Midnight (India time) of a 'YYYY-MM-DD' key as a Date. */
export const istMidnight = (key) => new Date(`${key}T00:00:00+05:30`);

/** 'YYYY-MM-DD' that is `days` after today (India time). */
export const istDateKeyOffset = (days, from = new Date()) =>
  istDateKey(new Date(istMidnight(istDateKey(from)).getTime() + days * DAY + 12 * 60 * 60 * 1000));

/** Day of week (0 = Sunday) of today in India time. */
export const istWeekday = (from = new Date()) =>
  new Date(istMidnight(istDateKey(from)).getTime() + 12 * 60 * 60 * 1000).getUTCDay();

/** 'YYYY-MM-DD HH:mm:ss' for the API. */
export const toApiDateTime = (key, time = '10:00') => `${key} ${time}:00`;

/** "Today", "Tomorrow" or "Thu 30 Oct" for a date key. */
export function dayLabel(key) {
  if (key === istDateKey()) return 'Today';
  if (key === istDateKeyOffset(1)) return 'Tomorrow';
  return istMidnight(key).toLocaleDateString('en-GB', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Key for a datetime coming from the API. */
export const dateKeyOf = (value) => {
  const date = parseAppDate(value);
  return date ? istDateKey(date) : '';
};

/** "10:30 am" in India time. */
export const timeOf = (value) => {
  const date = parseAppDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString('en-IN', { timeZone: APP_TIMEZONE, hour: 'numeric', minute: '2-digit' });
};
