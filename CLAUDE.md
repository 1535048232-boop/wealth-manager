# My App - Mobile Application

## Project Overview
一款基于 Expo + React Native 的跨平台移动应用。

## Tech Stack
- **Framework**: Expo SDK 52 + React Native
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind v4 (Tailwind CSS for RN)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **State**: Zustand (no Redux)
- **Animation**: React Native Reanimated
- **Form**: React Hook Form + Zod

## Commands
```bash
npx expo start              # 开发服务器
npx expo start --ios        # iOS 模拟器
npx expo start --android    # Android 模拟器
npm run test                # 测试
npx supabase db push        # 推送数据库变更
npx supabase gen types typescript --local > types/supabase.ts
```

## Project Structure
```
app/           # Expo Router pages (file-based routing)
  (auth)/      # 认证页面组（登录、注册）
  (tabs)/      # Tab 页面组（首页、探索、个人中心）
components/    # 可复用组件
  ui/          # 基础 UI: Button, Input, Card, Loading, Toast, Avatar
  common/      # 通用组件: ScreenWrapper
lib/           # 工具: supabase client, storage, utils
hooks/         # Custom hooks: useAuth, useSupabase
stores/        # Zustand stores: authStore, appStore
types/         # TypeScript types
constants/     # 颜色、配置常量
supabase/      # migrations/ + functions/
```

## Key Conventions
- 函数组件 only，禁止 class components
- 所有业务逻辑封装为 custom hooks
- Zustand 做全局状态，永远不用 Redux
- NativeWind className 写样式，不用 StyleSheet.create
- 所有 Supabase 操作通过 lib/supabase.ts
- 数据库必须启用 RLS
- 所有 async 函数必须 try-catch
- 组件使用 barrel export (index.ts)

## Reference Documents
- 编码规范 → @.claude/rules/coding-standards.md
- UI 模式 → @.claude/rules/ui-patterns.md
- Supabase → @.claude/rules/supabase-rules.md
- 产品需求 → @docs/PRD.md
- 任务清单 → @TODO.md
