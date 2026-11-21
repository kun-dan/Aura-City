import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext({ profile: null, loading: true });

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setProfile(await api.currentProfile());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const a = api.onAuthChange(refresh);
    const b = api.subscribe(refresh);
    return () => {
      a();
      b();
    };
  }, [refresh]);
  return <AuthContext.Provider value={{ profile, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const useMe = () => useContext(AuthContext).profile;

export function useLive(load, deps = []) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
    return api.subscribe(reload);
  }, [reload]);
  return { data, error, reload };
}

export function useLookups() {
  const { data } = useLive(async () => {
    const [departments, profiles] = await Promise.all([api.listDepartments(), api.listProfiles()]);
    return {
      departments,
      profiles,
      dept: (id) => departments.find((d) => d.id === id),
      person: (id) => profiles.find((p) => p.id === id),
    };
  });
  return data;
}
