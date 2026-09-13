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
