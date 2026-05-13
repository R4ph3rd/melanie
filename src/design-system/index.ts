// melanie Design System
// Dark-theme design tokens. Import these anywhere in the app,
// or extend via tailwind.config.js for class-based usage.

export const colors = {
  bg:       '#080808',
  surface:  '#111111',
  surface2: '#1a1a1a',
  surface3: '#222222',
  surface4: '#2a2a2a',
  border:   '#333333',
  borderBright: '#444444',

  textPrimary:   '#f0f0f0',
  textSecondary: '#a0a0a0',
  textMuted:     '#606060',
  textDisabled:  '#404040',

  accent:      '#7c3aed',
  accentHover: '#6d28d9',
  accentDim:   '#3b1f6e',

  nodeSketch:   '#1a1f2e',
  nodeOperator: '#1c1428',
  nodeMerge:    '#0f1d2e',
  nodeDiff:     '#0f1f18',
  nodeExtract:  '#1f1a0e',

  opModify:    '#7c3aed',
  opDuplicate: '#374151',
  opMerge:     '#1d4ed8',
  opDiff:      '#047857',
  opExtract:   '#b45309',

  success: '#10b981',
  warning: '#f59e0b',
  error:   '#ef4444',
  info:    '#3b82f6',
} as const

export const spacing = {
  0:   '0px',
  0.5: '2px',
  1:   '4px',
  1.5: '6px',
  2:   '8px',
  2.5: '10px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
} as const

export const radii = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
} as const

export const typography = {
  fontSans: '"Inter", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", "Fira Code", monospace',
  size2xs: '10px',
  sizeXs:  '11px',
  sizeSm:  '12px',
  sizeBase:'13px',
  sizeMd:  '14px',
  sizeLg:  '16px',
} as const

// Operator type metadata: colour + label used across the UI
export const operatorMeta: Record<string, { color: string; label: string; icon: string }> = {
  modify:    { color: colors.opModify,    label: 'Modify',    icon: '✦' },
  duplicate: { color: colors.opDuplicate, label: 'Duplicate', icon: '⎘' },
  merge:     { color: colors.opMerge,     label: 'Merge',     icon: '⊕' },
  diff:      { color: colors.opDiff,      label: 'Diff',      icon: '⊟' },
  extract:   { color: colors.opExtract,   label: 'Extract',   icon: '⊆' },
}

// CSS variable declarations: injected into :root by App
export const cssVars = Object.entries(colors)
  .map(([k, v]) => `--color-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`)
  .join('\n')
