-- ============================================================
-- Migration: Auto-create family_members row for the creator
--            when a new family is inserted
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_family_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- creator_id is UUID = profiles.id = auth.users.id
  -- Insert the creator as the family admin
  INSERT INTO public.family_members (
    family_id,
    user_id,
    profile_id,
    role,
    join_source
  )
  VALUES (
    NEW.id,
    NEW.creator_id,
    NEW.creator_id,
    'admin',
    'creator'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_family_created
  AFTER INSERT ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_family_created();
