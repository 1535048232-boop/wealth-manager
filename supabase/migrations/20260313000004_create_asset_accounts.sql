-- ============================================================
-- Migration: Create asset_accounts table
-- 资产账户表：记录家庭成员的各类资产账户信息
-- ============================================================

CREATE TABLE public.asset_accounts (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id        BIGINT        NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  account_type     VARCHAR(50)   NOT NULL
                     CHECK (account_type IN (
                       '银行卡', '支付宝', '微信', '公积金',
                       '股票', '期权', '现金', '保险', '基金', '其他'
                     )),
  account_name     VARCHAR(100)  NOT NULL,
  asset_quadrant   VARCHAR(50)
                     CHECK (asset_quadrant IN ('A类保值', 'B类消费', 'C类投资', 'D类保障')),
  description      TEXT,
  institution      VARCHAR(100),
  status           SMALLINT      NOT NULL DEFAULT 1
                     CHECK (status IN (1, 0)),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.asset_accounts                   IS '资产账户表';
COMMENT ON COLUMN public.asset_accounts.member_id         IS '所属成员ID，关联 family_members.id';
COMMENT ON COLUMN public.asset_accounts.account_type      IS '账户类型：银行卡/支付宝/微信/公积金/股票/期权/现金/保险/基金/其他';
COMMENT ON COLUMN public.asset_accounts.account_name      IS '账户名称，如招商银行工资卡、农行信用卡等';
COMMENT ON COLUMN public.asset_accounts.asset_quadrant    IS '资产四象限分类：A类保值/B类消费/C类投资/D类保障';
COMMENT ON COLUMN public.asset_accounts.description       IS '备注说明';
COMMENT ON COLUMN public.asset_accounts.institution       IS '所属机构/开户行';
COMMENT ON COLUMN public.asset_accounts.status            IS '状态：1=正常，0=作废';

-- 1. Enable Row Level Security
ALTER TABLE public.asset_accounts ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
--    Members can see asset_accounts belonging to members in their own family
CREATE POLICY "asset_accounts: select own family"
  ON public.asset_accounts
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.family_id IN (
         SELECT family_id FROM public.family_members
          WHERE user_id = auth.uid()
            AND status = 1
       )
         AND fm.status = 1
    )
  );

--    Members can insert their own asset accounts;
--    admin can insert accounts for any member in their family
CREATE POLICY "asset_accounts: insert self or admin"
  ON public.asset_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.status = 1
    )
    OR member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.family_id IN (
         SELECT family_id FROM public.family_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
            AND status = 1
       )
    )
  );

--    Members can update their own asset accounts;
--    admin can update any account within their family
CREATE POLICY "asset_accounts: update self or admin"
  ON public.asset_accounts
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.status = 1
    )
    OR member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.family_id IN (
         SELECT family_id FROM public.family_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
            AND status = 1
       )
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid()
         AND fm.status = 1
    )
    OR member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.family_id IN (
         SELECT family_id FROM public.family_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
            AND status = 1
       )
    )
  );

--    Only admin can hard-delete; regular members cannot delete
CREATE POLICY "asset_accounts: delete by admin"
  ON public.asset_accounts
  FOR DELETE
  TO authenticated
  USING (
    member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.family_id IN (
         SELECT family_id FROM public.family_members
          WHERE user_id = auth.uid()
            AND role = 'admin'
            AND status = 1
       )
    )
  );

-- 3. Auto-update updated_at
CREATE OR REPLACE TRIGGER asset_accounts_set_updated_at
  BEFORE UPDATE ON public.asset_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
