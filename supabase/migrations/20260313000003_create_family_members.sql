-- ============================================================
-- Migration: Create family_members table
-- ============================================================

-- 1. Create enum-like CHECK types for role / join_source
--    Using CHECK constraints to keep it simple and avoid enum migration pain.

CREATE TABLE public.family_members (
  id                      BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id               BIGINT        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  -- Link to Supabase Auth user (nullable: legacy/guest members may not have an auth account)
  user_id                 UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Display info delegated to profiles table
  profile_id              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone                   VARCHAR(20)   UNIQUE,
  password_hash           VARCHAR(255),
  pay_password_hash       VARCHAR(255),
  role                    VARCHAR(50)   NOT NULL DEFAULT 'member'
                            CHECK (role IN ('admin', 'member', 'guest')),
  join_time               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  join_source             VARCHAR(50)   NOT NULL DEFAULT 'invite'
                            CHECK (join_source IN ('creator', 'invite')),
  -- Self-referential: who invited this member (NULL for the creator)
  inviter_id              BIGINT        REFERENCES public.family_members(id) ON DELETE SET NULL,
  biometric_login_switch  SMALLINT      NOT NULL DEFAULT 0
                            CHECK (biometric_login_switch IN (0, 1)),
  status                  SMALLINT      NOT NULL DEFAULT 1
                            CHECK (status IN (1, 0, -1)),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.family_members.user_id               IS '关联 auth.users.id，允许 null（未绑定认证账号的成员）';
COMMENT ON COLUMN public.family_members.profile_id            IS '关联 profiles.id，存储头像、昵称等展示信息';
COMMENT ON COLUMN public.family_members.phone                 IS '手机号，唯一登录凭证';
COMMENT ON COLUMN public.family_members.pay_password_hash     IS '交易密码哈希，可选';
COMMENT ON COLUMN public.family_members.role                  IS '家庭角色：admin=超级管理员 / member=普通成员 / guest=受限成员';
COMMENT ON COLUMN public.family_members.join_source           IS '加入来源：creator=创建加入 / invite=邀请加入';
COMMENT ON COLUMN public.family_members.inviter_id            IS '邀请人 family_members.id，主动创建则为 null';
COMMENT ON COLUMN public.family_members.biometric_login_switch IS '生物识别登录开关：1=开启，0=关闭';
COMMENT ON COLUMN public.family_members.status                IS '状态：1=正常，0=已移除，-1=已禁用';

-- 2. Enable Row Level Security
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
--    Members can see their own rows (avoids infinite recursion)
CREATE POLICY "family_members: select own family"
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

--    Only admin of the family can insert new members
CREATE POLICY "family_members: insert by admin"
  ON public.family_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
    )
    -- allow self-insert when creating a new family (no members yet)
    OR NOT EXISTS (
      SELECT 1 FROM public.family_members AS fm2
       WHERE fm2.family_id = family_id
    )
  );

--    Admin can update members in their family; members can update their own row
CREATE POLICY "family_members: update admin or self"
  ON public.family_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR family_id IN (
      SELECT family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR family_id IN (
      SELECT family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
    )
  );

-- 4. Auto-update updated_at
CREATE OR REPLACE TRIGGER family_members_set_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Tighten families SELECT policy now that family_members exists
DROP POLICY IF EXISTS "families: select for members" ON public.families;

CREATE POLICY "families: select for members"
  ON public.families
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT family_id FROM public.family_members
       WHERE user_id = auth.uid()
         AND status = 1
    )
  );
