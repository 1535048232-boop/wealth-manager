-- ============================================================
-- Migration: Fix get_my_pending_family_invitation return type for family_name
-- ============================================================

-- Fix the return type mismatch between families.family_name (VARCHAR(100)) and function return type (TEXT)
-- The function should return VARCHAR(100) to match the actual column type, or we need to cast the column to TEXT

CREATE OR REPLACE FUNCTION public.get_my_pending_family_invitation()
RETURNS TABLE (
  invitation_id BIGINT,
  family_id BIGINT,
  family_name TEXT,
  family_avatar TEXT,
  inviter_name TEXT,
  expire_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = v_uid
      AND fm.status = 1
  ) THEN
    RETURN;
  END IF;

  SELECT trim(fm.phone)
  INTO v_phone
  FROM public.family_members fm
  WHERE fm.user_id = v_uid
    AND fm.phone IS NOT NULL
  ORDER BY CASE WHEN fm.status = 1 THEN 0 ELSE 1 END, fm.id ASC
  LIMIT 1;

  RETURN QUERY
  SELECT
    fi.id AS invitation_id,
    fi.family_id,
    f.family_name::TEXT AS family_name,  -- Cast VARCHAR(100) to TEXT to match return type
    f.family_avatar::TEXT AS family_avatar,  -- Cast VARCHAR(255) to TEXT to match return type
    p.display_name::TEXT AS inviter_name,  -- Cast to TEXT to be safe
    fi.expire_time
  FROM public.family_invitations fi
  JOIN public.families f ON f.id = fi.family_id
  LEFT JOIN public.family_members inviter_fm ON inviter_fm.id = fi.inviter_id
  LEFT JOIN public.profiles p ON p.id = inviter_fm.profile_id
  WHERE fi.status = 0
    AND fi.expire_time > NOW()
    AND (
      fi.invitee_user_id = v_uid
      OR (v_email <> '' AND fi.invitee_contact_type = 2 AND lower(trim(fi.invitee_contact)) = v_email)
      OR (coalesce(v_phone, '') <> '' AND fi.invitee_contact_type = 1 AND trim(fi.invitee_contact) = v_phone)
    )
  ORDER BY fi.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_family_invitation() TO authenticated;