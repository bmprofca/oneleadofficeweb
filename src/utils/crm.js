import { parseAppDate, formatDateTime } from './format';

/** Pipeline stages in order. `tone` maps to a CSS accent token. */
export const STAGES = [
  { key: 'new', label: 'New', tone: 'blue', probability: 5 },
  { key: 'contacted', label: 'Contacted', tone: 'cyan', probability: 15 },
  { key: 'qualified', label: 'Qualified', tone: 'indigo', probability: 35 },
  { key: 'proposal', label: 'Proposal', tone: 'amber', probability: 55 },
  { key: 'negotiation', label: 'Negotiation', tone: 'orange', probability: 75 },
  { key: 'won', label: 'Won', tone: 'emerald', probability: 100 },
  { key: 'lost', label: 'Lost', tone: 'rose', probability: 0 },
  { key: 'not_interested', label: 'Not interested', tone: 'slate', probability: 0 },
];

export const OPEN_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
export const CLOSED_STAGES = ['won', 'lost', 'not_interested'];

export const stageMeta = (key) => STAGES.find((s) => s.key === key) || { key, label: key, tone: 'slate' };
export const stageLabel = (key) => stageMeta(key).label;

/** Hex values for charts (SVG fills); mid-tones that read in light and dark. */
export const TONE_HEX = {
  blue: '#3b82f6',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  amber: '#f59e0b',
  orange: '#f97316',
  emerald: '#10b981',
  rose: '#f43f5e',
  slate: '#94a3b8',
  violet: '#8b5cf6',
  teal: '#14b8a6',
  sky: '#0ea5e9',
  lime: '#84cc16',
  pink: '#ec4899',
};

export const STAGE_HEX = Object.fromEntries(STAGES.map((s) => [s.key, TONE_HEX[s.tone]]));

export const TEMPERATURES = {
  hot: { label: 'Hot', tone: 'rose' },
  warm: { label: 'Warm', tone: 'amber' },
  cold: { label: 'Cold', tone: 'sky' },
};

export const TAG_COLORS = ['slate', 'indigo', 'blue', 'sky', 'teal', 'emerald', 'lime', 'amber', 'orange', 'rose', 'pink', 'violet'];

export const ACTIVITY_TYPES = [
  { key: 'call', label: 'Call' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'message', label: 'SMS' },
  { key: 'note', label: 'Note' },
];

export const activityLabel = (key) => ACTIVITY_TYPES.find((a) => a.key === key)?.label || key;

export const SOURCE_LABELS = {
  manual: 'Manual',
  'maps-import': 'Maps import',
  import: 'Import',
  website: 'Website',
  referral: 'Referral',
  whatsapp: 'WhatsApp',
  'walk-in': 'Walk-in',
  other: 'Other',
};

export const sourceLabel = (value) =>
  !value ? '—' : SOURCE_LABELS[value] || String(value).replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const currencyFormatters = {};
/** ₹1,25,000 — compact: ₹1.3L / ₹2.1Cr */
export function formatCurrency(value, { currency = 'INR', compact = false } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (compact && currency === 'INR' && Math.abs(n) >= 100000) {
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(n >= 100000000 ? 0 : 1)}Cr`;
    return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  }
  const key = `${currency}-${compact}`;
  currencyFormatters[key] ||= new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact || Number.isInteger(n) ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  });
  return currencyFormatters[key].format(n);
}

export const formatNumber = (value) => (Number(value) || 0).toLocaleString('en-IN');

/** "just now", "5 min ago", "in 2 h", "3 days ago", falls back to a date. */
export function formatRelative(value) {
  const date = parseAppDate(value);
  if (!date) return '—';
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const min = 60000;
  const hour = 60 * min;
  const day = 24 * hour;
  let text;
  if (abs < min) return 'just now';
  if (abs < hour) text = `${Math.round(abs / min)} min`;
  else if (abs < day) text = `${Math.round(abs / hour)} h`;
  else if (abs < 7 * day) text = `${Math.round(abs / day)} day${Math.round(abs / day) === 1 ? '' : 's'}`;
  else return formatDateTime(value, { day: 'numeric', month: 'short', year: 'numeric' });
  return future ? `in ${text}` : `${text} ago`;
}

export function isOverdue(value) {
  const date = parseAppDate(value);
  return !!date && date.getTime() < Date.now();
}

/** Digits suitable for tel:/wa.me links (adds India code to 10-digit numbers). */
export function phoneLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return { tel: `tel:+${intl}`, whatsapp: `https://wa.me/${intl}` };
}

/**
 * Best Google Maps link for a lead: its Business Profile, the imported map link,
 * its coordinates, or a search for name + address. Pass prefix 'lead_' for
 * reminder/appointment rows, which carry the lead's fields as lead_*.
 */
export function mapsLink(row, prefix = '') {
  if (!row) return null;
  const get = (key) => row[`${prefix}${key}`];
  const isUrl = (v) => /^https?:\/\//i.test(String(v || '').trim());
  if (isUrl(get('business_profile_url'))) return String(get('business_profile_url')).trim();
  if (isUrl(get('maps_url'))) return String(get('maps_url')).trim();
  const lat = Number(get('latitude'));
  const lng = Number(get('longitude'));
  if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const address = String(get('address') || '').trim();
  if (!address) return null;
  const name = String(prefix ? row.lead_name || '' : row.name || '').trim();
  const query = [name, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Trigger a browser download for a blob response. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Extract a readable error message from an axios error. */
export const apiError = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback;
