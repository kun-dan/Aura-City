import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Profile } from '../lib/types';

interface AuthValue {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({ profile: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setProfile(await api.currentProfile());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const offAuth = api.onAuthChange(() => void refresh());
    const offData = api.subscribe(() => void refresh()); // points and wallet update live
    return () => {
      offAuth();
      offData();
    };
  }, [refresh]);

  return <AuthContext.Provider value={{ profile, loading, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe used outside a signed-in route');
  return profile;
}
