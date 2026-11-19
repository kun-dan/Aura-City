import { Redirect } from 'expo-router';
import { useMe } from '../state/auth';

export default function Index() {
  const me = useMe();
  return <Redirect href={`/${me?.role ?? 'citizen'}`} />;
}
