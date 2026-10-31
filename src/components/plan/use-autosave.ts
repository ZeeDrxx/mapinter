"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

/**
 * Enregistrement automatique de lignes : les modifications sont regroupées par id
 * et envoyées après `delay` ms sans frappe (ou tout de suite), puis au démontage.
 */
export function useAutosave<P extends object>(
  save: (id: string, patch: P) => PromiseLike<{ error: unknown }>,
  delay = 600,
) {
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queued = useRef(new Map<string, P>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Suit une requête Supabase : compteur d'envois en cours et message d'erreur. */
  async function track<T extends { error: unknown }>(work: PromiseLike<T>): Promise<T | null> {
    setPending((n) => n + 1);
    try {
      const result = await work;
      if (result.error) throw result.error;
      setError(null);
      return result;
    } catch (e) {
      console.error(e);
      setError("Un enregistrement a échoué. Vérifiez votre connexion.");
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  }

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const batch = [...queued.current];
    queued.current.clear();
    for (const [id, patch] of batch) track(save(id, patch));
  }

  function queue(id: string, patch: P, { immediate = false } = {}) {
    queued.current.set(id, { ...queued.current.get(id), ...patch });
    if (timer.current) clearTimeout(timer.current);
    if (immediate) flush();
    else timer.current = setTimeout(flush, delay);
  }

  /** Oublie les modifications en attente (ligne supprimée). */
  function cancel(id: string) {
    queued.current.delete(id);
  }

  const flushOnUnmount = useEffectEvent(() => flush());
  useEffect(() => () => flushOnUnmount(), []);

  return { pending, error, track, queue, cancel };
}
