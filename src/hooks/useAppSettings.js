import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';

const FALLBACK = {
  lead_sources: ['manual', 'maps-import', 'import', 'website', 'referral', 'whatsapp', 'walk-in', 'other'],
  lost_reasons: ['Price too high', 'Chose competitor', 'No budget', 'Not reachable', 'No requirement', 'Other'],
  currency: 'INR',
  auto_assign_enabled: false,
};

let cache = null;
let inflight = null;
const listeners = new Set();

function fetchSettings() {
  inflight ||= api
    .get('/settings')
    .then(({ data }) => {
      cache = { ...FALLBACK, ...data };
      listeners.forEach((fn) => fn(cache));
      return cache;
    })
    .catch(() => cache || FALLBACK)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Workspace settings (lead sources, lost reasons, currency), shared across pages. */
export default function useAppSettings() {
  const [settings, setSettings] = useState(cache || FALLBACK);

  useEffect(() => {
    listeners.add(setSettings);
    if (!cache) fetchSettings();
    return () => listeners.delete(setSettings);
  }, []);

  const refresh = useCallback(() => {
    cache = null;
    return fetchSettings();
  }, []);

  return { settings, refresh };
}

/** Tags list, shared and refreshable. */
let tagCache = null;
const tagListeners = new Set();

export function useTags() {
  const [tags, setTags] = useState(tagCache || []);
  const refresh = useCallback(async () => {
    const { data } = await api.get('/tags');
    tagCache = data;
    tagListeners.forEach((fn) => fn(data));
    return data;
  }, []);

  useEffect(() => {
    tagListeners.add(setTags);
    if (!tagCache) refresh().catch(() => {});
    return () => tagListeners.delete(setTags);
  }, [refresh]);

  return { tags, refresh };
}
