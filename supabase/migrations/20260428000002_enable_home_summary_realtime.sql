-- ============================================================
-- Migration: Enable Realtime events for home summary refresh
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'asset_daily_snapshots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_daily_snapshots;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'asset_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_accounts;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
  END IF;
END
$$;