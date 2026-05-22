-- ============================================================
-- Migration: Add invite-code preview and accept RPCs
-- ============================================================

-- Query invitation metadata by invite code.
CREATE OR REPLACE FUNCTION public.get_family_invitation_by_code(p_invite_code TEXT)
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
  v_code TEXT := upper(trim(coalesce(p_invite_code, '')));
BEGIN
  IF v_code = '' THEN
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
    AND upper(fi.invite_code) = v_code
  LIMIT 1;
END;
$$;

-- Accept invitation by invite code (works for both email/phone invitation records).
CREATE OR REPLACE FUNCTION public.accept_family_invitation_by_code(p_invite_code TEXT)
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
  v_code TEXT := upper(trim(coalesce(p_invite_code, '')));
  v_inv public.family_invitations%ROWTYPE;
  v_existing_member_id BIGINT;
  v_existing_status SMALLINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '请先登录后再操作';
  END IF;

  IF v_code = '' THEN
    RAISE EXCEPTION '邀请码不能为空';
  END IF;

  SELECT *
  INTO v_inv
  FROM public.family_invitations fi
  WHERE fi.status = 0
    AND fi.expire_time > NOW()
    AND upper(fi.invite_code) = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已失效';
  END IF;

  -- One active family per user by product design.
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
  VALUES (v_uid, nullif(v_email, ''), COALESCE(split_part(v_email, '@', 1), '用户'))
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

GRANT EXECUTE ON FUNCTION public.get_family_invitation_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_family_invitation_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_family_invitation_by_code(TEXT) TO authenticated;
