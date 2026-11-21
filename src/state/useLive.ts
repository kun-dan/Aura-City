import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function useLive<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
    return api.subscribe(() => void reload());
  }, [reload]);

  return { data, error, reload };
}

export function useLookups() {
  const { data } = useLive(async () => {
    const [departments, profiles] = await Promise.all([api.listDepartments(), api.listProfiles()]);
    return {
      departments,
      profiles,
      dept: (id: string | null) => departments.find((d) => d.id === id),
      person: (id: string | null) => profiles.find((p) => p.id === id),
    };
  });
  return data;
}
