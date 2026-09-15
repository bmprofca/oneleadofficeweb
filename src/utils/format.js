export const APP_TIMEZONE = 'Asia/Kolkata';

/** Parse API/DB datetime values as Asia/Kolkata when no offset is present. */
export function parseAppDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && (/Z$/i.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw))) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T00:00:00+05:30`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
  const date = new Date(`${withSeconds}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(
  value,
  options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
) {
  const date = parseAppDate(value);
  if (!date) return value ? String(value) : '—';
  return date.toLocaleString('en-IN', {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}

export function formatOptionLabel(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatStatusLabel(value) {
  return formatOptionLabel(value);
}
