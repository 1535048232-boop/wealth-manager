-- Repair family creation edge cases:
-- 1. Back-fill creator membership rows for families that were inserted without
--    the on_family_created trigger creating a family_members row.
-- 2. Replace the family_members INSERT policy with explicit column references
--    so the "empty family" self-insert branch checks the row being inserted.

INSERT INTO public.family_members (family_id, user_id, profile_id, role, join_source)
SELECT
  f.id,
  f.creator_id,
  f.creator_id,
  'admin',
  'creator'
FROM public.families AS f
WHERE f.creator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_members AS fm
    WHERE fm.family_id = f.id
      AND fm.user_id = f.creator_id
  );

DROP POLICY IF EXISTS "family_members: insert by admin" ON public.family_members;

CREATE POLICY "family_members: insert by admin"
  ON public.family_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT fm.family_id
      FROM public.family_members AS fm
      WHERE fm.user_id = auth.uid()
        AND fm.role = 'admin'
        AND fm.status = 1
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.family_members AS fm2
      WHERE fm2.family_id = family_members.family_id
    )
  );
