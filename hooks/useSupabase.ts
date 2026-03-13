import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

interface UseSupabaseQueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>
): UseSupabaseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    queryFn().then(({ data, error }) => {
      if (!cancelled) {
        setData(data);
        setError(error);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tick]);

  return { data, error, isLoading, refetch: () => setTick(t => t + 1) };
}
