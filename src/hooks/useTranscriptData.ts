import { useEffect, useState } from 'react';
import type { TranscriptData } from '../types/session';

interface UseTranscriptDataResult {
  data: TranscriptData | null;
  isLoading: boolean;
  error: Error | null;
}

export function useTranscriptData(transcriptUrl?: string | null): UseTranscriptDataResult {
  const [data, setData] = useState<TranscriptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function load(): Promise<void> {
      if (!transcriptUrl) {
        setData(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(transcriptUrl);
        if (!response.ok) {
          throw new Error(`Transcript request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as TranscriptData;

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
  }, [transcriptUrl]);

  return { data, isLoading, error };
}