-- ============================================================
-- Migration: Restore asset_accounts SELECT scope for snapshot history
-- 仅在前端隐藏作废账户；历史快照查询仍可关联作废账户
-- ============================================================

DROP POLICY IF EXISTS "asset_accounts: select own family" ON public.asset_accounts;

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
