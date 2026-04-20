import { useEffect, useState } from 'react';
import type { SessionMetadata } from '../types/session';

interface UseSessionDataResult {
  data: SessionMetadata | null;
  isLoading: boolean;
  error: Error | null;
}

export function useSessionData(): UseSessionDataResult {
  const [data, setData] = useState<SessionMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function load(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${import.meta.env.BASE_URL}data/session-metadata.json`)
        if (!response.ok) {
          throw new Error(`Metadata request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as SessionMetadata;

        if (!isDisposed) {
          setData(payload);
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