import { useEffect, useState } from 'react';
import type { SessionIndexItem } from '../types/session';
import { resolvePublicUrl } from '../utils/publicUrl';

interface UseSessionIndexResult {
  data: SessionIndexItem[];
  isLoading: boolean;
  error: Error | null;
}

const SESSIONS_INDEX_URL = 'data/sessions.json';

export function useSessionIndex(): UseSessionIndexResult {
  const [data, setData] = useState<SessionIndexItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function load(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(resolvePublicUrl(SESSIONS_INDEX_URL));

        if (!response.ok) {
          throw new Error(`Sessions index request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as SessionIndexItem[];

        const sortedPayload = [...payload].sort((left, right) =>
          right.date.localeCompare(left.date),
        );

        if (!isDisposed) {
          setData(sortedPayload);
        }
      } catch (caughtError) {
        if (!isDisposed) {
          setError(caughtError instanceof Error ? caughtError : new Error('Unknown error'));
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isDisposed = true;
    };
  }, []);

  return { data, isLoading, error };
}