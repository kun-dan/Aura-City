import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Glass, GlassGroup, GlassPressable } from './Glass';
import { colors, font, radius } from '../theme';
import { STATUS_META, inr, timeAgo } from '../lib/rules';
import { photoSource } from '../lib/photos';
import { api } from '../lib/api';

/** Deep aurora backdrop: colour for the glass to refract. */
export function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0d1030', '#070b1a', '#0a0f22']} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb, { top: -120, left: -90, backgroundColor: '#6d4dff', opacity: 0.55 }]} />
      <View style={[styles.orb, { top: 160, right: -140, backgroundColor: '#13c8ec', opacity: 0.35 }]} />
      <View style={[styles.orb, { bottom: -160, left: -40, backgroundColor: '#ff3d7f', opacity: 0.28 }]} />
      <LinearGradient colors={['rgba(7,11,26,0)', 'rgba(7,11,26,0.55)']} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function HeaderActions() {
  const confirmSignOut = () =>
    Alert.alert('Switch account?', 'You will return to the sign-in screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => api.signOut() },
    ]);
  return (
    <GlassGroup spacing={8} style={styles.row}>
      <IconButton icon="sparkles" onPress={() => router.push('/aurabot')} label="AuraBot" />
      <IconButton icon="log-out-outline" onPress={confirmSignOut} label="Sign out" />
    </GlassGroup>
  );
}

export function IconButton({ icon, onPress, label, tint, size = 42 }) {
  return (
    <GlassPressable onPress={onPress} radius={size / 2} tint={tint} contentStyle={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.45} color={colors.text} accessibilityLabel={label} />
    </GlassPressable>
  );
}

/** Scrollable page with a large title, like iOS. */
export function Screen({ title, subtitle, children, right, refreshControl, scroll = true }) {
  const insets = useSafeAreaInsets();
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={font.caption}>{subtitle}</Text> : null}
        <Text style={font.largeTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
      </View>
      {right ?? <HeaderActions />}
    </View>
  );
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      {scroll ? (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {header}
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, tint, padded = true }) {
  return <Glass tint={tint} style={[padded && { padding: 16 }, { gap: 10 }, style]}>{children}</Glass>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginTop: 8, marginBottom: 2, paddingHorizontal: 4 }]}>
      <Text style={font.headline}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({ title, onPress, icon, variant = 'primary', disabled, loading, style }) {
  const tint = variant === 'primary' ? colors.primary : variant === 'danger' ? '#ef4444' : variant === 'good' ? '#10b981' : undefined;
  return (
    <GlassPressable
      onPress={onPress}
      disabled={disabled || loading}
      tint={tint}
      radius={radius.pill}
      style={style}
      contentStyle={styles.button}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : icon ? <Ionicons name={icon} size={18} color={colors.text} /> : null}
      <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
    </GlassPressable>
  );
}

export function Badge({ status }) {
  const m = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: m.color + '26', borderColor: m.color + '66' }]}>
      <View style={[styles.dot, { backgroundColor: m.color }]} />
      <Text style={[styles.badgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

export function Pill({ icon, text, color = colors.text }) {
  return (
    <Glass radius={radius.pill} style={styles.pill}>
      {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </Glass>
  );
}

export function Stars({ value, size = 14 }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? '#facc15' : colors.faint} />
      ))}
    </View>
  );
}

export function Stat({ label, value, sub, accent = colors.primary, style }) {
  return (
    <Glass style={[{ padding: 14, gap: 4, flexGrow: 1, flexBasis: '45%' }, style]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <Text style={font.caption}>{label}</Text>
      <Text style={[font.title, font.number]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={font.sub} numberOfLines={2}>{sub}</Text> : null}
    </Glass>
  );
}

export function IssueRow({ issue, dept, right, onPress }) {
  return (
    <GlassPressable onPress={onPress ?? (() => router.push(`/issue/${issue.id}`))} contentStyle={styles.issueRow}>
      <Image source={photoSource(issue.before_photo_url)} style={styles.thumb} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={font.headline} numberOfLines={1}>{issue.category ?? 'Classifying…'}</Text>
        <Text style={font.sub} numberOfLines={1}>{issue.address || issue.summary || issue.description}</Text>
        <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}>
          <Badge status={issue.status} />
          {dept ? <Text style={{ color: dept.color, fontSize: 12, fontWeight: '700' }}>{dept.name}</Text> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {right ?? (
          <>
            <Text style={[font.sub, { color: colors.text, fontWeight: '700' }]}>▲ {issue.upvotes}</Text>
            <Text style={font.sub}>{timeAgo(issue.created_at)}</Text>
            {issue.bounty != null ? <Text style={[font.sub, font.number]}>{inr(issue.bounty)}</Text> : null}
          </>
        )}
      </View>
    </GlassPressable>
  );
}

export function Empty({ text }) {
  return <Text style={[font.sub, { textAlign: 'center', paddingVertical: 18 }]}>{text}</Text>;
}

export function ErrorText({ text }) {
  if (!text) return null;
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={16} color="#fecaca" />
      <Text style={{ color: '#fecaca', flex: 1 }}>{text}</Text>
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <Glass radius={radius.pill} style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Text
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, active && styles.segmentActive]}
            suppressHighlighting
          >
            {o.label}
          </Text>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: 380, height: 380, borderRadius: 190 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 4, marginBottom: 12 },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  buttonText: { color: colors.text, fontWeight: '700', fontSize: 16, flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontWeight: '700', fontSize: 13 },
  accent: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2 },
  issueRow: { flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#1e293b' },
  error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)' },
  segment: { flexDirection: 'row', padding: 4, alignSelf: 'flex-start' },
  segmentItem: { color: colors.muted, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: 'hidden', fontSize: 14 },
  segmentActive: { color: colors.text, backgroundColor: 'rgba(255,255,255,0.16)' },
});
