import { useEffect, useState } from 'react';
import type { SessionSummary } from '../types/session';

interface UseSummaryDataResult {
  data: SessionSummary | null;
  isLoading: boolean;
  error: Error | null;
}

export function useSummaryData(summaryUrl?: string | null): UseSummaryDataResult {
  const [data, setData] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function load(): Promise<void> {
      if (!summaryUrl) {
        setData(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(summaryUrl);
        if (!response.ok) {
          throw new Error(`Summary request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as SessionSummary;

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
  }, [summaryUrl]);

  return { data, isLoading, error };
}