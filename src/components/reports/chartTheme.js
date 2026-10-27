/** Shared recharts styling — mirrors the conventions in pages/Dashboard.js. */
export const AXIS_TICK = { fontSize: 12, fill: 'var(--muted)' };

export const TOOLTIP_PROPS = {
  cursor: { fill: 'color-mix(in srgb, var(--brand) 6%, transparent)' },
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-md)',
    fontSize: 12,
    padding: '8px 12px',
  },
  labelStyle: { color: 'var(--ink)', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'var(--ink-2)', padding: 0 },
};

export const LEGEND_PROPS = {
  iconType: 'circle',
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: 'var(--muted)', paddingTop: 6 },
};
