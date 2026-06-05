// Web globals.css renk sistemi birebir Native ortama aktarıldı
export const colors = {
  bg:       '#0f0f13',
  surface:  '#18181f',
  surface2: '#22222d',
  border:   '#2e2e3d',
  accent:   '#7c6af7',
  accent2:  '#c084fc',
  green:    '#34d399',
  red:      '#f87171',
  yellow:   '#fbbf24',
  blue:     '#60a5fa',
  orange:   '#fb923c',
  text:     '#e8e8f0',
  muted:    '#6b6b80',
  white:    '#ffffff',
};

export const gradientHeader = ['#1a1a2e', '#16213e', '#0f3460'];

export const STATUS_COLOR: Record<string, string> = {
  arbeiten:  colors.green,
  urlaub:    colors.blue,
  krank:     colors.red,
  notdienst: colors.orange,
  feiertag:  colors.yellow,
  frei:      colors.muted,
};

export const STATUS_ICON: Record<string, string> = {
  arbeiten:  '✓',
  urlaub:    '🏖',
  krank:     '🤒',
  notdienst: '🚨',
  feiertag:  '🎉',
  frei:      '—',
};
