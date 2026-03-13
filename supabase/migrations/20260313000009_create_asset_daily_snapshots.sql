-- ============================================================
-- Migration: Create asset_daily_snapshots table
-- 资产日快照表：记录每个账户每日的余额快照，用于趋势图和报表
-- ============================================================

-- 0. Ensure helper function exists (first defined in migration 8;
--    repeated here with CREATE OR REPLACE so this migration is
--    self-contained if applied independently).
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS BIGINT
STABLE
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT family_id
  FROM   family_members
  WHERE  user_id = auth.uid()
    AND  status  = 1
  LIMIT 1
$$;

CREATE TABLE public.asset_daily_snapshots (
  id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id      BIGINT          NOT NULL
                    REFERENCES public.asset_accounts(id) ON DELETE CASCADE,
  snapshot_date   DATE            NOT NULL DEFAULT CURRENT_DATE,
  amount          DECIMAL(18, 2)  NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- 同一账户同一天只允许一条快照
  CONSTRAINT asset_daily_snapshots_account_date_unique
    UNIQUE (account_id, snapshot_date)
);

COMMENT ON TABLE  public.asset_daily_snapshots                    IS '资产日快照表';
COMMENT ON COLUMN public.asset_daily_snapshots.account_id         IS '关联 asset_accounts.id';
COMMENT ON COLUMN public.asset_daily_snapshots.snapshot_date      IS '快照日期';
COMMENT ON COLUMN public.asset_daily_snapshots.amount             IS '当日账户金额';

-- 1. Enable Row Level Security
ALTER TABLE public.asset_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies

--    SELECT: any family member can see snapshots for accounts in their family
CREATE POLICY "asset_daily_snapshots: select own family"
  ON public.asset_daily_snapshots
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.family_id = public.get_my_family_id()
        AND  fm.status    = 1
    )
  );

--    INSERT: member can insert snapshots for their own accounts;
--            admin can insert for any account within their family
CREATE POLICY "asset_daily_snapshots: insert self or admin"
  ON public.asset_daily_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.user_id = auth.uid()
        AND  fm.status  = 1
    )
    OR account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.family_id = public.get_my_family_id()
        AND  fm.status    = 1
        AND EXISTS (
          SELECT 1 FROM public.family_members
          WHERE  user_id   = auth.uid()
            AND  role      = 'admin'
            AND  status    = 1
            AND  family_id = fm.family_id
        )
    )
  );

--    UPDATE: same rules as INSERT
CREATE POLICY "asset_daily_snapshots: update self or admin"
  ON public.asset_daily_snapshots
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.user_id = auth.uid()
        AND  fm.status  = 1
    )
    OR account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.family_id = public.get_my_family_id()
        AND  fm.status    = 1
        AND EXISTS (
          SELECT 1 FROM public.family_members
          WHERE  user_id   = auth.uid()
            AND  role      = 'admin'
            AND  status    = 1
            AND  family_id = fm.family_id
        )
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.user_id = auth.uid()
        AND  fm.status  = 1
    )
    OR account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.family_id = public.get_my_family_id()
        AND  fm.status    = 1
        AND EXISTS (
          SELECT 1 FROM public.family_members
          WHERE  user_id   = auth.uid()
            AND  role      = 'admin'
            AND  status    = 1
            AND  family_id = fm.family_id
        )
    )
  );

--    DELETE: admin only
CREATE POLICY "asset_daily_snapshots: delete by admin"
  ON public.asset_daily_snapshots
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT aa.id
      FROM   public.asset_accounts AS aa
      INNER JOIN public.family_members AS fm ON fm.id = aa.member_id
      WHERE  fm.family_id = public.get_my_family_id()
        AND  fm.status    = 1
        AND EXISTS (
          SELECT 1 FROM public.family_members
          WHERE  user_id   = auth.uid()
            AND  role      = 'admin'
            AND  status    = 1
            AND  family_id = fm.family_id
        )
    )
  );

-- 3. Auto-update updated_at
CREATE OR REPLACE TRIGGER asset_daily_snapshots_set_updated_at
  BEFORE UPDATE ON public.asset_daily_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
