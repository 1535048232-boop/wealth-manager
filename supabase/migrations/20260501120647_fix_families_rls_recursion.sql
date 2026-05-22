-- Fix families RLS recursion during family creation.
--
-- The previous INSERT policy queried public.families from inside a policy on
-- public.families:
--
--   AND NOT EXISTS (SELECT 1 FROM public.families WHERE creator_id = auth.uid())
--
-- That self-reference can trigger Postgres RLS recursion (42P17). The unique
-- constraint families_creator_id_unique already enforces one family per creator,
-- so the RLS policy only needs to ensure users create rows for themselves.

DROP POLICY IF EXISTS "families: insert authenticated" ON public.families;

CREATE POLICY "families: insert authenticated"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());
