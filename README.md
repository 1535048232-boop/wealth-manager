# My App

基于 Expo + React Native 的跨平台移动应用，支持 iOS 和 Android。

## 技术栈

| 层级 | 技术 |
|------|------|
| Framework | Expo SDK 55 + React Native 0.83 |
| Language | TypeScript 5.9 (strict mode) |
| Routing | Expo Router v4 (file-based) |
| Styling | NativeWind v4 (Tailwind CSS) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| State | Zustand v5 |
| Animation | React Native Reanimated v4 |
| Form | React Hook Form v7 + Zod v4 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 并填入你的 Supabase 项目信息：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> Supabase 控制台 → Project Settings → API 获取以上信息

### 3. 启动开发服务器

```bash
npx expo start          # 扫码或选择平台
npx expo start --ios    # 直接启动 iOS 模拟器
npx expo start --android # 直接启动 Android 模拟器
```

## 项目结构

```
my-app/
├── app/                    # 页面（Expo Router 文件路由）
│   ├── (auth)/             # 认证页面组
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/             # Tab 导航页面组
│   │   ├── index.tsx       # 首页
│   │   ├── explore.tsx     # 探索
│   │   └── profile.tsx     # 个人中心
│   └── _layout.tsx         # 根布局（路由守卫）
├── components/
│   ├── ui/                 # 基础组件：Button, Input, Card, Loading, Avatar, Toast
│   └── common/             # 通用组件：ScreenWrapper
├── lib/
│   ├── supabase.ts         # Supabase 客户端
│   ├── storage.ts          # SecureStore 封装
│   └── utils.ts            # 工具函数
├── hooks/
│   ├── useAuth.ts          # 路由守卫 hook
│   └── useSupabase.ts      # 数据查询 hook
├── stores/
│   ├── authStore.ts        # 认证状态（Zustand）
│   └── appStore.ts         # 全局应用状态
├── types/                  # TypeScript 类型定义
├── constants/              # 颜色、配置常量
├── supabase/
│   ├── migrations/         # 数据库迁移文件
│   └── functions/          # Edge Functions
└── docs/                   # 产品文档、线框图
```

## 常用命令

```bash
# 开发
npx expo start                    # 启动开发服务器

# 类型检查
npx tsc --noEmit                  # 检查 TypeScript 错误

# Supabase
npx supabase db push              # 推送数据库变更
npx supabase gen types typescript --local > types/supabase.ts  # 生成类型
```

## 开发规范

- 样式使用 NativeWind `className`，禁止 `StyleSheet.create`
- 全局状态用 Zustand，禁止 Redux
- 所有 Supabase 操作通过 `lib/supabase.ts`
- 数据库表必须启用 RLS
- 详见 `.claude/rules/` 下的规范文档

## 环境要求

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS 开发：Xcode 15+ (macOS)
- Android 开发：Android Studio + JDK 17
