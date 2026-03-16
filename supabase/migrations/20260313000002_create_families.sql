-- ============================================================
-- Migration: Create families table
-- ============================================================

-- 1. Create the families table
CREATE TABLE public.families (
  id                       BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_name              VARCHAR(100)    NOT NULL,
  creator_id               UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  family_avatar            VARCHAR(255),
  description              TEXT,
  currency                 VARCHAR(10)     NOT NULL DEFAULT 'CNY',
  debt_warning_threshold   NUMERIC(5, 2)   NOT NULL DEFAULT 20.00,
  repayment_reminder_switch SMALLINT       NOT NULL DEFAULT 1 CHECK (repayment_reminder_switch IN (0, 1)),
  data_export_switch       SMALLINT        NOT NULL DEFAULT 1 CHECK (data_export_switch IN (0, 1)),
  created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.families.creator_id               IS '家庭创建者，关联 profiles.id，拥有超级管理员权限';
COMMENT ON COLUMN public.families.currency                 IS '家庭记账本位币，默认 CNY';
COMMENT ON COLUMN public.families.debt_warning_threshold   IS '负债率警告阈值（%），超过后自动推送提醒，默认 20%';
COMMENT ON COLUMN public.families.repayment_reminder_switch IS '还款日全局提醒开关：1=开启，0=关闭';
COMMENT ON COLUMN public.families.data_export_switch       IS '数据导出权限开关：1=仅管理员可导出，0=所有成员可导出';

-- 2. Enable Row Level Security
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
--    Any authenticated member of the family can view it
--    (refined per-member check will be added after family_members table exists)
CREATE POLICY "families: select for members"
  ON public.families
  FOR SELECT
  TO authenticated
  USING (true);  -- tightened in a later migration once family_members exists

--    Only the creator can update family settings
CREATE POLICY "families: update by creator"
  ON public.families
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

--    Any authenticated user can create a family (they become creator after family_members row inserted)
CREATE POLICY "families: insert authenticated"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Auto-update updated_at
CREATE OR REPLACE TRIGGER families_set_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
