import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../state/auth';
import Login from '../screens/Login';
import { Backdrop } from '../components/ui';
import { colors } from '../theme';

function Gate() {
  const { profile, loading } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <Backdrop />
        <ActivityIndicator color={colors.text} size="large" />
      </View>
    );
  if (!profile) return <Login />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="citizen" />
      <Stack.Screen name="resolver" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="issue/[id]" />
      <Stack.Screen name="aurabot" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
