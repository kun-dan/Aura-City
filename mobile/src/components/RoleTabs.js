import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useMe } from '../state/auth';
import { colors } from '../theme';

export function RoleTabs({ role, tabs }) {
  const me = useMe();
  if (!me) return null;
  if (me.role !== role) return <Redirect href={`/${me.role}`} />;
  return (
    <NativeTabs
      tintColor={colors.cyan}
      iconColor={{ default: colors.muted, selected: colors.cyan }}
      backgroundColor="#0e1330"
      indicatorColor="rgba(56,225,255,0.18)"
      labelStyle={{ default: { color: colors.muted }, selected: { color: colors.text } }}
      minimizeBehavior="onScrollDown"
    >
      {tabs.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <NativeTabs.Trigger.Icon sf={t.sf} md={t.md} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
