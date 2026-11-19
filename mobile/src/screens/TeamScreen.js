import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useLookups, useMe } from '../state/auth';
import { Glass, GlassPressable } from '../components/Glass';
import { ErrorText, Screen } from '../components/ui';
import { colors, font } from '../theme';

const ROLES = ['citizen', 'resolver', 'admin'];

export default function TeamScreen() {
  const me = useMe();
  const lookups = useLookups();
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const change = async (id, role, dept) => {
    setError(null);
    try {
      await api.setUserRole(id, role, dept);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Screen title="Team" subtitle="People & roles">
      <Text style={font.sub}>New sign-ups are citizens. Promote verified department workers to resolvers and pick their department.</Text>
      <ErrorText text={error} />
      {(lookups?.profiles ?? []).map((p) => (
        <Glass key={p.id} style={{ padding: 14, gap: 10 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={font.headline}>{p.full_name}{p.id === me.id ? ' (you)' : ''}</Text>
              <Text style={font.sub}>
                {p.role}{p.role === 'resolver' ? ` · ${lookups.dept(p.department_id)?.name}` : ''}{p.role === 'citizen' ? ` · ${p.points} pts` : ''}
              </Text>
            </View>
            {p.id !== me.id && (
              <Text style={styles.edit} onPress={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Done' : 'Edit'}</Text>
            )}
          </View>
          {open === p.id && (
            <>
              <View style={styles.chips}>
                {ROLES.map((r) => (
                  <GlassPressable key={r} radius={12} tint={p.role === r ? colors.primary : undefined} onPress={() => change(p.id, r, p.department_id)} contentStyle={styles.chip}>
                    <Text style={styles.chipText}>{r}</Text>
                  </GlassPressable>
                ))}
              </View>
              {p.role === 'resolver' && (
                <View style={styles.chips}>
                  {lookups.departments.map((d) => (
                    <GlassPressable key={d.id} radius={12} tint={p.department_id === d.id ? d.color : undefined} onPress={() => change(p.id, 'resolver', d.id)} contentStyle={styles.chip}>
                      <Text style={styles.chipText}>{d.name}</Text>
                    </GlassPressable>
                  ))}
                </View>
              )}
            </>
          )}
        </Glass>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  edit: { color: colors.cyan, fontWeight: '700', padding: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
});
