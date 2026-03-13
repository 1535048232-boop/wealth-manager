# Supabase 项目经验

## 邮箱注册 / 登录

- **开发环境关闭邮件确认**：Supabase Dashboard → Authentication → Providers → Email → 关闭 "Confirm email"
  - 关闭后注册即登录，无需确认邮件，彻底规避 `Email not confirmed` 和 `email rate limit exceeded` 问题
  - 生产环境建议重新开启，并配置自定义 SMTP（避免 Supabase 默认限速）
- `signUpWithEmail` 返回的 `needsConfirmation = !data.session && !!data.user`，可用于区分是否需要引导用户去收件箱
- 重发确认邮件：`supabase.auth.resend({ type: 'signup', email })`

---

## RLS 策略：避免自引用无限递归

**问题**：某张表（如 `family_members`）的 SELECT 策略若在 `USING` 中对**自身**做子查询，会触发无限递归，报错：
```
infinite recursion detected in policy for relation "family_members"
```

**错误写法**：
```sql
-- ❌ 递归：USING 内子查询了自身表
CREATE POLICY "family_members: select own family"
  ON public.family_members FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members AS fm
       WHERE fm.user_id = auth.uid() AND fm.status = 1
    )
  );
```

**正确写法**：直接判断当前行字段，不做同表子查询：
```sql
-- ✅ 无递归：只判断当前行
CREATE POLICY "family_members: select own family"
  ON public.family_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

**原则**：任何表的 RLS SELECT 策略，**禁止在 `USING` 子句内对自身表做子查询**。
如需跨表校验（如验证成员角色），应在应用层拆分为两步查询，或使用 `SECURITY DEFINER` 函数绕过 RLS。
