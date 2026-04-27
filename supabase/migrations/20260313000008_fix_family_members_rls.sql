-- ============================================================
-- Migration: Fix infinite recursion in family_members SELECT policy
-- The old policy did a sub-SELECT on family_members itself,
-- causing RLS to call itself recursively.
-- New policy: a member can only see rows where user_id = auth.uid()
-- ============================================================

DROP POLICY IF EXISTS "family_members: select own family" ON public.family_members;

CREATE POLICY "family_members: select own family"
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
