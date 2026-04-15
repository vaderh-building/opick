import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet.js';
import { apiGet, apiPatch } from '../lib/api.js';

export function useProfile() {
  const { account } = useWallet();
  const [profile, setProfile] = useState(null); // null=loading, false=no profile, object=exists
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async (wallet) => {
    if (!wallet) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/profiles/${wallet.toLowerCase()}`);
      setProfile(data);
    } catch (err) {
      if (err.status === 404) {
        setProfile(false);
      } else {
        setError(err.message);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile(account);
  }, [account, fetchProfile]);

  const refresh = useCallback(() => {
    fetchProfile(account);
  }, [account, fetchProfile]);

  const updateProfile = useCallback(async (patch) => {
    const data = await apiPatch('/profiles/me', patch);
    setProfile(data);
    return data;
  }, []);

  return { profile, loading, error, refresh, updateProfile };
}
