-- ============================================================
-- Migration: Support account-search family invitations
-- ============================================================

ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS invitee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.family_invitations.invitee_user_id IS '被邀请账号的 auth.users.id，命中站内账号时用于弹窗确认邀请';

CREATE INDEX IF NOT EXISTS family_invitations_invitee_user_id_idx
  ON public.family_invitations (invitee_user_id);

-- Backfill historical invitations when we can identify the account by email or phone.
UPDATE public.family_invitations fi
SET invitee_user_id = p.id
FROM public.profiles p
WHERE fi.invitee_user_id IS NULL
  AND fi.invitee_contact_type = 2
  AND lower(trim(fi.invitee_contact)) = lower(trim(p.email));

UPDATE public.family_invitations fi
SET invitee_user_id = fm.user_id
FROM public.family_members fm
WHERE fi.invitee_user_id IS NULL
  AND fi.invitee_contact_type = 1
  AND fm.user_id IS NOT NULL
  AND trim(fi.invitee_contact) = trim(fm.phone);

CREATE OR REPLACE FUNCTION public.search_invitable_account(p_query TEXT)
RETURNS TABLE (
  account_user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  phone TEXT,
  matched_contact TEXT,
  matched_contact_type SMALLINT,
  already_in_family BOOLEAN,
  pending_invitation BOOLEAN,
  active_family_name TEXT,
  is_self BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_family_id BIGINT;
  v_query TEXT := trim(coalesce(p_query, ''));
  v_is_email BOOLEAN := position('@' IN trim(coalesce(p_query, ''))) > 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '请先登录后再操作';
  END IF;

  SELECT fm.family_id
  INTO v_family_id
  FROM public.family_members fm
  WHERE fm.user_id = v_uid
    AND fm.role = 'admin'
    AND fm.status = 1
  ORDER BY fm.id ASC
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION '仅家庭管理员可以邀请成员';
  END IF;

  IF v_query = '' THEN
    RETURN;
  END IF;

  IF v_is_email THEN
    RETURN QUERY
    WITH candidate AS (
      SELECT
        p.id AS account_user_id,
        p.display_name,
        p.avatar_url,
        p.email,
        (
          SELECT fm.phone
          FROM public.family_members fm
          WHERE fm.user_id = p.id
            AND fm.phone IS NOT NULL
          ORDER BY CASE WHEN fm.status = 1 THEN 0 ELSE 1 END, fm.id ASC
          LIMIT 1
        )::TEXT AS phone,
        lower(trim(p.email))::TEXT AS matched_contact,
        2::SMALLINT AS matched_contact_type
      FROM public.profiles p
      WHERE lower(trim(p.email)) = lower(v_query)
      LIMIT 1
    )
    SELECT
      c.account_user_id,
      c.display_name,
      c.avatar_url,
      c.email,
      c.phone,
      c.matched_contact,
      c.matched_contact_type,
      EXISTS (
        SELECT 1
        FROM public.family_members fm
        WHERE fm.family_id = v_family_id
          AND fm.user_id = c.account_user_id
          AND fm.status = 1
      ) AS already_in_family,
      EXISTS (
        SELECT 1
        FROM public.family_invitations fi
        WHERE fi.family_id = v_family_id
          AND fi.status = 0
          AND fi.expire_time > NOW()
          AND (
            fi.invitee_user_id = c.account_user_id
            OR (fi.invitee_contact_type = 2 AND lower(trim(fi.invitee_contact)) = c.matched_contact)
          )
      ) AS pending_invitation,
      (
        SELECT f.family_name
        FROM public.family_members fm
        JOIN public.families f ON f.id = fm.family_id
        WHERE fm.user_id = c.account_user_id
          AND fm.status = 1
          AND fm.family_id <> v_family_id
        ORDER BY fm.id ASC
        LIMIT 1
      ) AS active_family_name,
      c.account_user_id = v_uid AS is_self
    FROM candidate c;

    RETURN;
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT
      fm.user_id AS account_user_id,
      p.display_name,
      p.avatar_url,
      p.email,
      fm.phone::TEXT,
      trim(fm.phone)::TEXT AS matched_contact,
      1::SMALLINT AS matched_contact_type
    FROM public.family_members fm
    LEFT JOIN public.profiles p ON p.id = COALESCE(fm.profile_id, fm.user_id)
    WHERE fm.user_id IS NOT NULL
      AND fm.phone IS NOT NULL
      AND trim(fm.phone) = v_query
    ORDER BY CASE WHEN fm.status = 1 THEN 0 ELSE 1 END, fm.id ASC
    LIMIT 1
  )
  SELECT
    c.account_user_id,
    c.display_name,
    c.avatar_url,
    c.email,
    c.phone,
    c.matched_contact,
    c.matched_contact_type,
    EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.family_id = v_family_id
        AND fm.user_id = c.account_user_id
        AND fm.status = 1
    ) AS already_in_family,
    EXISTS (
      SELECT 1
      FROM public.family_invitations fi
      WHERE fi.family_id = v_family_id
        AND fi.status = 0
        AND fi.expire_time > NOW()
        AND (
          fi.invitee_user_id = c.account_user_id
          OR (fi.invitee_contact_type = 1 AND trim(fi.invitee_contact) = c.matched_contact)
        )
    ) AS pending_invitation,
    (
      SELECT f.family_name
      FROM public.family_members fm
      JOIN public.families f ON f.id = fm.family_id
      WHERE fm.user_id = c.account_user_id
        AND fm.status = 1
        AND fm.family_id <> v_family_id
      ORDER BY fm.id ASC
      LIMIT 1
    ) AS active_family_name,
    c.account_user_id = v_uid AS is_self
  FROM candidate c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_invitable_account(TEXT) TO authenticated;

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
    f.family_name::TEXT AS family_name,
    f.family_avatar::TEXT AS family_avatar,
    p.display_name::TEXT AS inviter_name,
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
  v_phone TEXT;
  v_inv public.family_invitations%ROWTYPE;
  v_existing_member_id BIGINT;
  v_existing_status SMALLINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '请先登录后再操作';
  END IF;

  SELECT trim(fm.phone)
  INTO v_phone
  FROM public.family_members fm
  WHERE fm.user_id = v_uid
    AND fm.phone IS NOT NULL
  ORDER BY CASE WHEN fm.status = 1 THEN 0 ELSE 1 END, fm.id ASC
  LIMIT 1;

  SELECT *
  INTO v_inv
  FROM public.family_invitations fi
  WHERE fi.id = p_invitation_id
    AND fi.status = 0
    AND fi.expire_time > NOW()
    AND (
      fi.invitee_user_id = v_uid
      OR (v_email <> '' AND fi.invitee_contact_type = 2 AND lower(trim(fi.invitee_contact)) = v_email)
      OR (coalesce(v_phone, '') <> '' AND fi.invitee_contact_type = 1 AND trim(fi.invitee_contact) = v_phone)
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已失效';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = v_uid
      AND fm.status = 1
      AND fm.family_id <> v_inv.family_id
  ) THEN
    RAISE EXCEPTION '您已在其他家庭中，无法加入该邀请';
  END IF;

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
    invitee_user_id = COALESCE(invitee_user_id, v_uid),
    updated_at = NOW()
  WHERE id = v_inv.id;

  RETURN QUERY SELECT v_existing_member_id, v_inv.family_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_family_invitation(p_invitation_id BIGINT)
RETURNS BOOLEAN
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
    RAISE EXCEPTION '请先登录后再操作';
  END IF;

  SELECT trim(fm.phone)
  INTO v_phone
  FROM public.family_members fm
  WHERE fm.user_id = v_uid
    AND fm.phone IS NOT NULL
  ORDER BY CASE WHEN fm.status = 1 THEN 0 ELSE 1 END, fm.id ASC
  LIMIT 1;

  UPDATE public.family_invitations fi
  SET
    status = -1,
    invitee_user_id = COALESCE(fi.invitee_user_id, v_uid),
    updated_at = NOW()
  WHERE fi.id = p_invitation_id
    AND fi.status = 0
    AND fi.expire_time > NOW()
    AND (
      fi.invitee_user_id = v_uid
      OR (v_email <> '' AND fi.invitee_contact_type = 2 AND lower(trim(fi.invitee_contact)) = v_email)
      OR (coalesce(v_phone, '') <> '' AND fi.invitee_contact_type = 1 AND trim(fi.invitee_contact) = v_phone)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已失效';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_family_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_family_invitation(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_family_invitation(BIGINT) TO authenticated;
