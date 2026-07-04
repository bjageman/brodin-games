import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Read a single field from a JSON blob stored in localStorage.
 * Returns the fallback when the key is missing, the JSON is corrupt,
 * or the field is null/undefined. Falsy stored values (false, 0, '')
 * are returned as-is.
 */
export function readPersistedField<T>(storageKey: string, field: string, fallback: T): T {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const value = (JSON.parse(saved) as Record<string, unknown>)[field];
      if (value !== undefined && value !== null) return value as T;
    } catch (e) {
      console.error(e);
    }
  }
  return fallback;
}

/**
 * useState initialized from a field of a JSON blob in localStorage.
 * Persisting changes back is the caller's responsibility.
 */
export function usePersistedField<T>(
  storageKey: string,
  field: string,
  fallback: T
): [T, Dispatch<SetStateAction<T>>] {
  return useState<T>(() => readPersistedField(storageKey, field, fallback));
}
