-- ============================================================
-- Migration: Allow creators to always see their own family
--            (family_members row may not exist for early-created families)
-- ============================================================

-- Tighten families SELECT: creator OR member
DROP POLICY IF EXISTS "families: select for members" ON public.families;

CREATE POLICY "families: select for members"
  ON public.families
  FOR SELECT
  TO authenticated
  USING (
    -- creator can always see their own family
    creator_id = auth.uid()
    OR
    -- any active member can see the family
    id IN (
      SELECT family_id FROM public.family_members
       WHERE user_id = auth.uid()
         AND status = 1
    )
  );

-- Repair: back-fill missing family_members rows for existing creators
-- (safe to run multiple times — INSERT ... WHERE NOT EXISTS)
INSERT INTO public.family_members (family_id, user_id, profile_id, role, join_source)
SELECT
  f.id,
  f.creator_id,
  f.creator_id,
  'admin',
  'creator'
FROM public.families f
WHERE f.creator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.family_members fm
     WHERE fm.family_id = f.id
       AND fm.user_id   = f.creator_id
  );
