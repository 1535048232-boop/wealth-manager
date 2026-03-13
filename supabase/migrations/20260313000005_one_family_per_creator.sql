-- ============================================================
-- Migration: Prevent a profile from creating more than one family
-- ============================================================

-- 1. Unique constraint: one creator_id can only appear once in families
ALTER TABLE public.families
  ADD CONSTRAINT families_creator_id_unique UNIQUE (creator_id);

-- 2. Tighten INSERT RLS: reject if the user already owns a family
DROP POLICY IF EXISTS "families: insert authenticated" ON public.families;

CREATE POLICY "families: insert authenticated"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- caller must set themselves as creator
    creator_id = auth.uid()
    -- and must not already own a family
    AND NOT EXISTS (
      SELECT 1 FROM public.families
       WHERE creator_id = auth.uid()
    )
  );
