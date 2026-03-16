-- ============================================================
-- Migration: Hide invalidated asset accounts on SELECT
-- 资产账户查询不返回作废(status=0)记录
-- ============================================================

DROP POLICY IF EXISTS "asset_accounts: select own family" ON public.asset_accounts;

CREATE POLICY "asset_accounts: select own family"
  ON public.asset_accounts
  FOR SELECT
  TO authenticated
  USING (
    status = 1
    AND member_id IN (
      SELECT fm.id FROM public.family_members AS fm
       WHERE fm.family_id IN (
         SELECT family_id FROM public.family_members
          WHERE user_id = auth.uid()
            AND status = 1
       )
         AND fm.status = 1
    )
  );
