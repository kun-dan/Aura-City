import { Platform } from 'react-native';

export const colors = {
  bg: '#070b1a',
  text: '#f2f5ff',
  muted: 'rgba(226,232,255,0.62)',
  faint: 'rgba(226,232,255,0.38)',
  primary: '#8b7bff',
  cyan: '#38e1ff',
  good: '#34d399',
  bad: '#f87171',
  warn: '#fbbf24',
  hairline: 'rgba(255,255,255,0.18)',
  glassFill: 'rgba(255,255,255,0.08)',
  glassFillStrong: 'rgba(255,255,255,0.14)',
};

export const radius = { sm: 14, md: 22, lg: 30, pill: 999 };

export const font = {
  largeTitle: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  headline: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  caption: { fontSize: 11, color: colors.faint, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  number: { fontVariant: ['tabular-nums'] },
};

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';
