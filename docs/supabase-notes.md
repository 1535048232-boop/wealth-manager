# Supabase 项目经验

## 邮箱注册 / 登录

- **开发环境关闭邮件确认**：Supabase Dashboard → Authentication → Providers → Email → 关闭 "Confirm email"
  - 关闭后注册即登录，无需确认邮件，彻底规避 `Email not confirmed` 和 `email rate limit exceeded` 问题
  - 生产环境建议重新开启，并配置自定义 SMTP（避免 Supabase 默认限速）
- `signUpWithEmail` 返回的 `needsConfirmation = !data.session && !!data.user`，可用于区分是否需要引导用户去收件箱
- 重发确认邮件：`supabase.auth.resend({ type: 'signup', email })`
