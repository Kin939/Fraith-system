import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useCampaignStore } from '../lib/store';
import type { AuthUser } from '../lib/types';

export function useAuth() {
  const user = useCampaignStore((s) => s.user);
  const authReady = useCampaignStore((s) => s.authReady);
  const setUser = useCampaignStore((s) => s.setUser);
  const setAuthReady = useCampaignStore((s) => s.setAuthReady);
  const bootstrapCampaignData = useCampaignStore((s) => s.bootstrapCampaignData);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ user: AuthUser }>('/api/auth/me', { timeoutMs: 8000 });
        if (!cancelled) {
          setUser(res.user);
          await bootstrapCampaignData().catch(() => {
            // Non-fatal on slow/throttled mobile links; individual tabs can still retry
          });
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setAuthReady, bootstrapCampaignData]);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      setAuthError(null);
      try {
        const res = await apiFetch<{ user: AuthUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        setUser(res.user);
        await bootstrapCampaignData();
        return true;
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Ошибка входа');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setUser, bootstrapCampaignData]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, [setUser]);

  return {
    user,
    authReady,
    loading,
    authError,
    login,
    logout,
  };
}
