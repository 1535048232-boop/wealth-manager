-- ============================================================
-- Migration: Create family_invitations table
-- 调整后的家庭邀请表（适配邮箱邀请）
-- ============================================================

CREATE TABLE public.family_invitations (
  id                    BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id             BIGINT        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  inviter_id            BIGINT        REFERENCES public.family_members(id) ON DELETE SET NULL,
  invitee_contact       VARCHAR(100)  NOT NULL,
  invitee_contact_type  SMALLINT      NOT NULL
                                      CHECK (invitee_contact_type IN (1, 2)),
  invite_code           VARCHAR(20)   NOT NULL UNIQUE,
  last_send_time        TIMESTAMPTZ,
  expire_time           TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status                SMALLINT      NOT NULL DEFAULT 0
                                      CHECK (status IN (0, 1, -1)),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.family_invitations IS '家庭邀请表，支持手机号/邮箱邀请';
COMMENT ON COLUMN public.family_invitations.family_id            IS '关联 families.id';
COMMENT ON COLUMN public.family_invitations.inviter_id           IS '邀请人ID，关联 family_members.id';
COMMENT ON COLUMN public.family_invitations.invitee_contact      IS '被邀请人联系方式（邮箱/手机号）';
COMMENT ON COLUMN public.family_invitations.invitee_contact_type IS '联系方式类型：1=手机号，2=邮箱';
COMMENT ON COLUMN public.family_invitations.invite_code          IS '邀请码（唯一）';
COMMENT ON COLUMN public.family_invitations.last_send_time       IS '最后一次发送邀请时间';
COMMENT ON COLUMN public.family_invitations.expire_time          IS '邀请过期时间，默认创建后7天';
COMMENT ON COLUMN public.family_invitations.status               IS '状态：0=待确认，1=已接受，-1=已拒绝/已过期/已撤销';

CREATE INDEX family_invitations_family_id_idx
  ON public.family_invitations (family_id);

CREATE INDEX family_invitations_contact_idx
  ON public.family_invitations (invitee_contact, invitee_contact_type);

CREATE INDEX family_invitations_status_expire_idx
  ON public.family_invitations (status, expire_time);

-- 1. Enable Row Level Security
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
--    Family members can view invitations in their own family
CREATE POLICY "family_invitations: select own family"
  ON public.family_invitations
  FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT fm.family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.status = 1
    )
  );

--    Only admin can create invitations for their family
CREATE POLICY "family_invitations: insert by admin"
  ON public.family_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
         AND fm.family_id = family_id
    )
  );

--    Only admin can update invitations in their family
CREATE POLICY "family_invitations: update by admin"
  ON public.family_invitations
  FOR UPDATE
  TO authenticated
  USING (
    family_id IN (
      SELECT fm.family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT fm.family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
    )
  );

--    Only admin can delete invitations in their family
CREATE POLICY "family_invitations: delete by admin"
  ON public.family_invitations
  FOR DELETE
  TO authenticated
  USING (
    family_id IN (
      SELECT fm.family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.role = 'admin'
         AND fm.status = 1
    )
  );

-- 3. Auto-update updated_at
CREATE OR REPLACE TRIGGER family_invitations_set_updated_at
  BEFORE UPDATE ON public.family_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
