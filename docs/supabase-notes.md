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

**推荐写法**：用 `SECURITY DEFINER` 函数提前缓存当前用户的 `family_id`，然后在策略中引用函数结果，彻底避免递归：

```sql
-- 1. 一次性定义辅助函数（不触发策略递归）
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS BIGINT STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid() AND status = 1 LIMIT 1
$$;

-- 2. 策略调用函数，无递归
CREATE POLICY "family_members: view family"
  ON public.family_members FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());
```

---

## RLS 策略：让家庭成员互相查看资料

`family_members` 和 `profiles` 默认只能看自己的行（`user_id = auth.uid()`）。
若需要在 **录入页** 等地方看到所有家庭成员的账户与昵称，需要追加以下策略（见 migration 0008）：

```sql
-- profiles 追加策略：可看同家庭成员的 profile
CREATE POLICY "profiles: view family member profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT user_id FROM family_members
       WHERE family_id = public.get_my_family_id()
         AND user_id IS NOT NULL AND status = 1
    )
  );
```

**PostgREST join 注意**：通过 `asset_accounts.select('*, family_members!inner(*, profiles!profile_id(...))')` 做联表查询时，PostgREST 会对每个被 join 的表**单独应用其 RLS**。因此必须确保 `family_members` 和 `profiles` 的策略允许读取目标行，否则 inner join 会过滤掉其他成员的账户。
