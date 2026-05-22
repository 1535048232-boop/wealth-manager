-- ============================================================
-- Migration: Fix search_invitable_account active_family_name type
-- ============================================================

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
  v_is_email BOOLEAN := position('@' IN v_query) > 0;
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
    WITH account_candidates AS (
      SELECT
        p.id AS account_user_id,
        nullif(trim(p.display_name), '') AS display_name,
        p.avatar_url,
        lower(trim(p.email)) AS email,
        NULL::TEXT AS phone,
        1 AS source_priority
      FROM public.profiles p
      WHERE lower(trim(p.email)) = lower(v_query)

      UNION ALL

      SELECT
        au.id AS account_user_id,
        NULL::TEXT AS display_name,
        NULL::TEXT AS avatar_url,
        lower(trim(au.email)) AS email,
        NULL::TEXT AS phone,
        2 AS source_priority
      FROM auth.users au
      WHERE lower(trim(coalesce(au.email, ''))) = lower(v_query)
    ),
    deduped_candidate AS (
      SELECT DISTINCT ON (candidate.account_user_id)
        candidate.account_user_id,
        candidate.display_name,
        candidate.avatar_url,
        candidate.email,
        (
          SELECT fm.phone
          FROM public.family_members fm
          WHERE fm.user_id = candidate.account_user_id
            AND fm.phone IS NOT NULL
          ORDER BY CASE WHEN fm.status = 1 THEN 0 ELSE 1 END, fm.id ASC
          LIMIT 1
        )::TEXT AS phone,
        candidate.email::TEXT AS matched_contact,
        2::SMALLINT AS matched_contact_type,
        candidate.source_priority
      FROM account_candidates candidate
      ORDER BY candidate.account_user_id, candidate.source_priority
    )
    SELECT
      c.account_user_id,
      COALESCE(
        c.display_name,
        (
          SELECT nullif(trim(p2.display_name), '')
          FROM public.profiles p2
          WHERE p2.id = c.account_user_id
          LIMIT 1
        ),
        split_part(c.email, '@', 1)
      ) AS display_name,
      COALESCE(
        c.avatar_url,
        (
          SELECT p2.avatar_url
          FROM public.profiles p2
          WHERE p2.id = c.account_user_id
          LIMIT 1
        )
      ) AS avatar_url,
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
        SELECT f.family_name::TEXT
        FROM public.family_members fm
        JOIN public.families f ON f.id = fm.family_id
        WHERE fm.user_id = c.account_user_id
          AND fm.status = 1
          AND fm.family_id <> v_family_id
        ORDER BY fm.id ASC
        LIMIT 1
      ) AS active_family_name,
      c.account_user_id = v_uid AS is_self
    FROM deduped_candidate c
    LIMIT 1;

    RETURN;
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT
      fm.user_id AS account_user_id,
      COALESCE(nullif(trim(p.display_name), ''), split_part(lower(trim(coalesce(p.email, ''))), '@', 1)) AS display_name,
      p.avatar_url,
      lower(trim(p.email)) AS email,
      trim(fm.phone)::TEXT AS phone,
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
      SELECT f.family_name::TEXT
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
