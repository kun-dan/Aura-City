import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { Backdrop, Button, Card, Pill } from '../components/ui';
import { Glass, GlassPressable, hasLiquidGlass } from '../components/Glass';
import { colors, font } from '../theme';

const ROLES = [
  { role: 'citizen', icon: 'person', title: 'Citizen', blurb: 'Report issues, upvote, vote on City Mood' },
  { role: 'resolver', icon: 'construct', title: 'Resolver', blurb: 'Fix jobs, get paid after the AI audit' },
  { role: 'admin', icon: 'business', title: 'City Admin', blurb: 'Budget, audits and contractors' },
];
const STEPS = [
  ['camera', 'Report', 'Photo + map pin'],
  ['sparkles', 'Classify', 'AI picks the department'],
  ['hammer', 'Resolve', 'Worker uploads proof'],
  ['shield-checkmark', 'Audit & Pay', 'AI verifies, treasury pays'],
];

export default function Login() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  useEffect(() => {
    api.users().then(setUsers);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Glass radius={26} tint={colors.primary} style={styles.logo}>
          <Ionicons name="location" size={34} color="#fff" />
        </Glass>
        <Text style={styles.brand}>Auracity</Text>
        <Text style={[font.body, { color: colors.muted }]}>
          Report a civic issue with one photo. AI routes it to the right department, verifies the repair, and releases payment only for real fixes.
        </Text>
        <View style={styles.pills}>
          <Pill icon="sparkles" text={api.aiEnabled ? `AI: ${api.aiModel}` : 'AI offline mode'} color={api.aiEnabled ? '#86efac' : colors.warn} />
          {hasLiquidGlass ? <Pill icon="water" text="Liquid Glass" /> : null}
        </View>

        <View style={styles.steps}>
          {STEPS.map(([icon, t, s], i) => (
            <Glass key={t} style={styles.step}>
              <Text style={[font.caption, { color: colors.cyan }]}>0{i + 1}</Text>
              <Ionicons name={icon} size={20} color={colors.text} />
              <Text style={font.headline}>{t}</Text>
              <Text style={font.sub}>{s}</Text>
            </Glass>
          ))}
        </View>

        <Text style={[font.title, { marginTop: 8 }]}>Choose who you are</Text>
        <Text style={font.sub}>Everything runs on this phone. Switch accounts any time to see each side of the city.</Text>
        {ROLES.map((r) => (
          <Card key={r.role}>
            <View style={styles.roleHead}>
              <Ionicons name={r.icon} size={18} color={colors.cyan} />
              <Text style={font.headline}>{r.title}</Text>
            </View>
            <Text style={font.sub}>{r.blurb}</Text>
            <View style={styles.chips}>
              {users.filter((u) => u.role === r.role).map((u) => (
                <GlassPressable key={u.id} onPress={() => api.signInAs(u.id)} radius={14} contentStyle={styles.chip}>
                  <Text style={styles.chipText}>{u.full_name}</Text>
                </GlassPressable>
              ))}
            </View>
          </Card>
        ))}

        <Card>
          <Text style={font.headline}>New here?</Text>
          <Glass radius={14} style={{ paddingHorizontal: 14 }}>
            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.faint} style={styles.input} />
          </Glass>
          <Button title="Join as citizen" icon="person-add" disabled={!name.trim()} onPress={() => api.signUp(name)} />
        </Card>

        <Button
          title="Reset demo data"
          icon="refresh"
          variant="plain"
          onPress={() =>
            Alert.alert('Reset all data?', 'Every report, payment and account goes back to the starting state.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: async () => { await api.resetAll(); setUsers(await api.users()); } },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 14 },
  logo: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 46, fontWeight: '900', color: colors.text, letterSpacing: -1.5 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  step: { flexBasis: '47%', flexGrow: 1, padding: 14, gap: 4 },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { color: colors.text, fontWeight: '600' },
  input: { color: colors.text, fontSize: 16, paddingVertical: 12 },
});
