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
EXPO_PUBLIC_WEB_BASE_URL=https://your-web-domain.com

# Edge Function (邀请提醒)
APP_WEB_BASE_URL=https://your-web-domain.com
APP_SCHEME=myapp
RESEND_API_KEY=your-resend-api-key
INVITE_EMAIL_FROM=Wealth App <noreply@your-domain.com>
```

`EXPO_PUBLIC_WEB_BASE_URL` 用于生成 H5 链接（如邀请链接、密码重置回跳地址）；未配置时会自动回退到 App Deep Link（如 `myapp://invite?code=xxxx`）。

`APP_WEB_BASE_URL`、`APP_SCHEME`、`RESEND_API_KEY`、`INVITE_EMAIL_FROM` 用于 `send-family-invitation` Edge Function 发送邀请提醒邮件。
若未配置邮件相关变量（`RESEND_API_KEY` / `INVITE_EMAIL_FROM`），邀请流程仍可使用，但会自动降级为手动分享邀请链接。

> Supabase 控制台 → Project Settings → API 获取以上信息

### 3. 启动开发服务器

```bash
npx expo start          # 扫码或选择平台
npx expo start --ios    # 直接启动 iOS 模拟器
npx expo start --android # 直接启动 Android 模拟器
npx expo start --web    # 直接启动 Web 开发环境
```

### 4. 启动 Web 版本

本项目支持通过 Expo Web 在浏览器中运行。

启动命令：

```bash
npx expo start --web
```

启动后：

- 终端会显示本地访问地址，一般是 `http://localhost:8081`
- 浏览器会自动打开 Web 页面；如果没有自动打开，手动访问终端输出的地址即可

如果只是想统一先启动 Expo 开发服务器，再手动切到 Web，也可以：

```bash
npx expo start
```

然后在终端交互菜单里按 `w` 打开 Web。

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
npx expo start --web              # 启动 Web 开发环境

# 类型检查
npx tsc --noEmit                  # 检查 TypeScript 错误

# Supabase
npx supabase db push              # 推送数据库变更
npx supabase gen types typescript --local > types/supabase.ts  # 生成类型
npx supabase functions deploy send-family-invitation            # 部署邀请提醒函数
```

## 新人上手流程

这一节只写新成员最容易卡住、且本项目已经验证过能走通的流程。

### 1. 本地启动并连接数据库

先安装依赖并准备 `.env`：

```bash
npm install
```

`.env` 至少需要以下变量：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_WEB_BASE_URL=https://your-web-domain.com
```

然后启动开发环境：

```bash
npx expo start
```

说明：

- App 启动时会立即初始化 Supabase，缺少 `EXPO_PUBLIC_SUPABASE_URL` 或 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 时，发布包很容易在启动阶段直接失败。
- `.env` 只对本地开发有效，不会自动进入 EAS 云构建。

### 2. 同步 Expo / EAS 环境变量

如果要构建安卓安装包或 iOS 模拟器包，必须先把 `.env` 里的 `EXPO_PUBLIC_*` 变量同步到 EAS。

先查看当前环境变量：

```bash
eas env:list preview
eas env:list production
```

把变量写入 `preview` 和 `production`：

```bash
eas env:create preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --visibility plaintext --non-interactive --force
eas env:create production --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --visibility plaintext --non-interactive --force

eas env:create preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --visibility sensitive --non-interactive --force
eas env:create production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --visibility sensitive --non-interactive --force

eas env:create preview --name EXPO_PUBLIC_WEB_BASE_URL --value "https://your-web-domain.com" --visibility plaintext --non-interactive --force
eas env:create production --name EXPO_PUBLIC_WEB_BASE_URL --value "https://your-web-domain.com" --visibility plaintext --non-interactive --force
```

同步完成后再次确认：

```bash
eas env:list preview
eas env:list production
```

建议：

- URL 用 `plaintext`
- 可公开注入客户端的 key 用 `sensitive`
- 不要把数据库密码、Service Role Key 这类服务端凭证写进 `EXPO_PUBLIC_*`

### 3. 启动 Web 本地版本

如果只是让新人先在浏览器里跑起来，最短路径就是直接启动 Web：

```bash
npx expo start --web
```

常见用法：

- 本地前端联调：直接访问终端输出的本地地址
- 账号登录、路由跳转、基础页面样式验证：优先在 Web 上快速确认
- 如果涉及原生能力差异，再切回 iOS / Android 模拟器验证

补充说明：

- Web 运行同样依赖 `.env` 中的 `EXPO_PUBLIC_SUPABASE_URL` 和 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_WEB_BASE_URL` 主要用于生成回跳链接、邀请链接等 H5 地址
- Web 本地启动不依赖 EAS 环境变量，直接读取本地 `.env`

如果需要导出静态 Web 产物，可使用：

```bash
npx expo export --platform web
```

导出结果默认在 `dist/` 目录。

### 4. 创建安卓安装包

本项目已经配置好 `preview` 安卓构建，产物是可直接安装的 `apk`。

构建命令：

```bash
eas build --platform android --profile preview --non-interactive
```

构建成功后，EAS 会输出一个构建页链接和二维码。用法：

- 在电脑上打开构建页
- 或直接用安卓手机扫码/打开链接下载安装包

如果你执行的是下面这个默认命令：

```bash
eas build --platform android
```

它默认走 `production` profile，因此 `production` 环境变量也必须提前配置完整。

### 5. 启动 iOS 模拟器版本

没有 Apple Developer 账号时：

- 不能生成真机可安装的 iOS `ipa`
- 不能上 TestFlight
- 但可以生成并运行 iOS Simulator 构建

本项目已经在 `eas.json` 中加入了 `ios-simulator` profile。

构建命令：

```bash
eas build --platform ios --profile ios-simulator --non-interactive
```

构建完成后，可以直接运行到本机模拟器：

```bash
eas build:run --id <IOS_BUILD_ID> --platform ios
```

如果本机装了 Xcode 和 Simulator，EAS CLI 会自动：

- 下载构建产物
- 让你选择一个模拟器机型
- 安装并启动 App

### 6. 常见问题

#### 安卓包打开即闪退

优先检查：

1. `preview` / `production` 环境里是否存在 `EXPO_PUBLIC_SUPABASE_URL`
2. `preview` / `production` 环境里是否存在 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. 构建日志里是否出现 “Environment variables ... loaded from the environment on EAS”

如果 EAS 没加载到这些变量，构建包即使成功，也可能在启动阶段直接失败。

#### iOS 为什么只能跑模拟器

因为真机安装、Ad Hoc 分发、TestFlight、App Store 发布都依赖 Apple Developer Program。没有 Apple Developer 账号时，最现实的路径就是：

- iPhone 真机用 Expo Go 调试
- 原生构建验证放到 iOS Simulator

#### Web 启动失败或页面空白

优先检查：

1. `.env` 是否存在并包含 `EXPO_PUBLIC_SUPABASE_URL`
2. `.env` 是否存在并包含 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. 浏览器控制台是否有 Supabase 初始化报错

如果 Web 能启动但页面白屏，通常先看浏览器控制台，再看 Expo 终端输出。

#### 如何确认本机有模拟器环境

```bash
xcrun simctl list devices | head -n 20
```

如果能列出 `iPhone` / `iPad` 模拟器设备，就说明本机 Simulator 工具链可用。

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
