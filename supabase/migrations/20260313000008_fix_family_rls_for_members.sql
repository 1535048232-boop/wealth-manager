-- ============================================================
-- Migration: Fix family_members + profiles RLS so all family
--            members can see each other (needed for Entry page).
--
-- Problem: Migration 7 set family_members SELECT to
--   USING (user_id = auth.uid())  — only own row visible.
-- That prevents joining asset_accounts to get member names.
--
-- Solution: Use a SECURITY DEFINER helper to look up the
-- caller's family_id without triggering recursion, then allow
-- seeing every active row in that family.
-- ============================================================

-- 1. Helper function: returns caller's family_id bypassing RLS
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS BIGINT
STABLE
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT family_id
  FROM   family_members
  WHERE  user_id = auth.uid()
    AND  status  = 1
  LIMIT 1
$$;

-- 2. Replace the single-row policy on family_members
DROP POLICY IF EXISTS "family_members: select own family" ON public.family_members;

CREATE POLICY "family_members: view family"
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (family_id = public.get_my_family_id());

-- 3. Add policy so a member can read co-members' profiles
--    (profiles: select own already exists for own row; this
--     adds a second policy for family-member profiles)
DROP POLICY IF EXISTS "profiles: view family member profiles" ON public.profiles;

CREATE POLICY "profiles: view family member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT user_id
      FROM   family_members
      WHERE  family_id  = public.get_my_family_id()
        AND  user_id   IS NOT NULL
        AND  status     = 1
    )
  );
