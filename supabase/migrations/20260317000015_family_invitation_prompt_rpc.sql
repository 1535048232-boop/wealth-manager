-- ============================================================
-- Migration: Family invitation prompt RPCs (invitee side)
-- ============================================================

-- Returns one pending invitation for current authenticated user.
-- Matching strategy: email invite only (invitee_contact_type = 2).
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
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  -- Already an active family member: no invite popup needed.
  IF EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = v_uid
      AND fm.status = 1
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fi.id AS invitation_id,
    fi.family_id,
    f.family_name,
    f.family_avatar,
    p.display_name AS inviter_name,
    fi.expire_time
  FROM public.family_invitations fi
  JOIN public.families f ON f.id = fi.family_id
  LEFT JOIN public.family_members inviter_fm ON inviter_fm.id = fi.inviter_id
  LEFT JOIN public.profiles p ON p.id = inviter_fm.profile_id
  WHERE fi.status = 0
    AND fi.expire_time > NOW()
    AND fi.invitee_contact_type = 2
    AND lower(fi.invitee_contact) = v_email
  ORDER BY fi.created_at DESC
  LIMIT 1;
END;
$$;

-- Accept one invitation by id for current authenticated user.
CREATE OR REPLACE FUNCTION public.accept_family_invitation(p_invitation_id BIGINT)
RETURNS TABLE (
  member_id BIGINT,
  family_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_inv public.family_invitations%ROWTYPE;
  v_existing_member_id BIGINT;
  v_existing_status SMALLINT;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RAISE EXCEPTION '请先登录后再操作';
  END IF;

  SELECT *
  INTO v_inv
  FROM public.family_invitations fi
  WHERE fi.id = p_invitation_id
    AND fi.status = 0
    AND fi.expire_time > NOW()
    AND fi.invitee_contact_type = 2
    AND lower(fi.invitee_contact) = v_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已失效';
  END IF;

  -- App flow assumes one active family per user.
  IF EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = v_uid
      AND fm.status = 1
      AND fm.family_id <> v_inv.family_id
  ) THEN
    RAISE EXCEPTION '您已在其他家庭中，无法加入该邀请';
  END IF;

  -- Ensure profile exists for old/legacy users.
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (v_uid, v_email, split_part(v_email, '@', 1))
  ON CONFLICT (id) DO NOTHING;

  SELECT fm.id, fm.status
  INTO v_existing_member_id, v_existing_status
  FROM public.family_members fm
  WHERE fm.family_id = v_inv.family_id
    AND fm.user_id = v_uid
  ORDER BY fm.id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_member_id IS NULL THEN
    INSERT INTO public.family_members (
      family_id,
      user_id,
      profile_id,
      role,
      join_source,
      inviter_id,
      status
    )
    VALUES (
      v_inv.family_id,
      v_uid,
      v_uid,
      'member',
      'invite',
      v_inv.inviter_id,
      1
    )
    RETURNING id INTO v_existing_member_id;
  ELSIF v_existing_status <> 1 THEN
    UPDATE public.family_members
    SET
      profile_id = v_uid,
      role = 'member',
      join_source = 'invite',
      inviter_id = v_inv.inviter_id,
      status = 1,
      updated_at = NOW()
    WHERE id = v_existing_member_id;
  END IF;

  UPDATE public.family_invitations
  SET
    status = 1,
    updated_at = NOW()
  WHERE id = v_inv.id;

  RETURN QUERY SELECT v_existing_member_id, v_inv.family_id;
END;
$$;

-- Reject one invitation by id for current authenticated user.
CREATE OR REPLACE FUNCTION public.reject_family_invitation(p_invitation_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RAISE EXCEPTION '请先登录后再操作';
  END IF;

  UPDATE public.family_invitations fi
  SET
    status = -1,
    updated_at = NOW()
  WHERE fi.id = p_invitation_id
    AND fi.status = 0
    AND fi.expire_time > NOW()
    AND fi.invitee_contact_type = 2
    AND lower(fi.invitee_contact) = v_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已失效';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_family_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_family_invitation(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_family_invitation(BIGINT) TO authenticated;
