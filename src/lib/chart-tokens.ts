/**
 * TenureIQ Chart Design Tokens
 * Centralised chart colours, sequences, and defaults for Recharts components.
 */

export const CHART_COLOURS = {
  primary: '#20808D',    // Teal
  secondary: '#A84B2F',  // Terra/rust
  tertiary: '#1B474D',   // Dark teal
  quaternary: '#BCE2E7', // Light cyan
  quinary: '#944454',    // Mauve
  gold: '#FFC553',
  olive: '#848456',
  brown: '#6E522B',
} as const;

export const CHART_SEQUENCE = Object.values(CHART_COLOURS);

/** Semantic chart colours for positive/negative/neutral indicators */
export const CHART_SEMANTIC = {
  positive: '#437A22',
  negative: '#A12C7B',
  neutral: '#7A7974',
  baseline: '#D4D1CA',
} as const;

/** Common Recharts configuration defaults */
export const CHART_DEFAULTS = {
  margin: { top: 5, right: 20, bottom: 5, left: 0 },
  fontSize: 12,
  tickLine: false,
  axisLine: false,
  gridStrokeDasharray: '3 3',
  gridStroke: '#E5E7EB',
  animationDuration: 800,
} as const;

/** Tooltip style matching TenureIQ card theme (uses CSS variables for dark-mode compat) */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    color: 'hsl(var(--popover-foreground))',
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

/** Axis tick style using CSS variables */
export const CHART_AXIS_TICK = {
  fill: 'hsl(var(--muted-foreground))',
  fontSize: 11,
} as const;
