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

## 敏感信息约定

仓库默认不包含任何可直接用于发布、签名、提审或调用第三方服务的敏感信息。

提交代码前请遵守：

- `.env`、`credentials.json`、`credentials/` 下的真实文件只保留在本机，不提交到仓库
- 以 `.example` 文件作为模板，复制后再填写真实值
- `eas.json` 只保留非敏感构建配置，不保存个人 Apple 账号、证书密码、Google Play service account 内容

新开发者需要向维护者索取的信息：

| 场景 | 必需信息 | 用途 |
|------|----------|------|
| 本地开发 / Web 联调 | `EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_ANON_KEY`、`EXPO_PUBLIC_WEB_BASE_URL` | 启动 App、登录、邀请链接回跳 |
| 邀请邮件 Edge Function | `APP_WEB_BASE_URL`、`APP_SCHEME`、`RESEND_API_KEY`、`INVITE_EMAIL_FROM` | 发送家庭邀请邮件 |
| Android 提交 Google Play | `credentials/android/service-account.json` | `eas submit --platform android` |
| iOS 提交 App Store Connect | `appleId`、`ascAppId`、`appleTeamId` | `eas submit --platform ios` |
| iOS 本地签名 / 本地构建 | `credentials.json`、`credentials/ios/dist-cert.p12`、`credentials/ios/profile.mobileprovision` | 本地签名、证书与描述文件 |

仓库中已经提供：

- `.env.example`
- `.env.release.local.example`
- `credentials.example.json`

附加说明：

- iOS 发布说明见 `docs/ios-release.md`
- iOS 发布时，**优先看 `docs/ios-release.md` 里的“已验证上传路径（2026-05-03）”**；该文档已经补充了 `eas submit` 失败时切换到 `altool` / Transporter 的回退方案
- 本地配置自检命令：`npm run check:local-config -- <scenario>`

建议初始化步骤：

```bash
cp .env.example .env
cp .env.release.local.example .env.release.local
cp credentials.example.json credentials.json
```

日常开发通常只需要 `.env`。只有在本地签名、提交商店或本地 EAS 构建时，才需要继续补齐 `.env.release.local`、`credentials.json` 和 `credentials/` 下的真实文件。

## 本地缺失配置清单

其他开发者接手仓库时，可以按下面的清单判断自己缺了什么：

| 使用场景 | 需要存在的本地文件 | 还需要你提供的关键信息 |
|------|----------------|------------------------|
| 日常开发 / Web 联调 | `.env` | Supabase URL、Anon Key、Web Base URL |
| 邀请邮件联调 | `.env` | Resend API Key、发件邮箱、App Scheme |
| Android 提交 Google Play | `credentials/android/service-account.json` | Google Play Service Account JSON |
| iOS 本地签名 / 本地构建 | `credentials.json`、`credentials/ios/dist-cert.p12`、`credentials/ios/profile.mobileprovision` | 证书密码、描述文件、签名材料 |
| iOS 提交 TestFlight / App Store | `.env.release.local` | `EXPO_APPLE_ID`、`ASC_APP_ID`、`APPLE_TEAM_ID`，必要时还包括 `EXPO_APPLE_APP_SPECIFIC_PASSWORD` |

如果某个场景暂时用不到，对应文件可以先不创建。

可直接运行本地自检：

```bash
npm run check:local-config -- dev
npm run check:local-config -- ios-submit
npm run check:local-config -- all
```

支持的 `scenario`：`dev`、`invite`、`ios-build`、`ios-submit`、`android-submit`、`all`。

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

基于 `.env.example` 创建本地 `.env`，再填入你的 Supabase 项目信息：

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

如果你没有这些值，请直接向维护者索取，不要把临时测试 key 或个人账号信息提交到仓库。

### 2.1 发布相关本地配置

如果你需要执行发布、提审或本地签名，请再基于 `.env.release.local.example` 创建本地 `.env.release.local`：

```bash
cp .env.release.local.example .env.release.local
```

这个文件仅保存在本机，不提交到 GitHub，用来记录 iOS 提审时会用到的本地信息。

完整发布步骤见 `docs/ios-release.md`。

补充提醒：

- `eas build --platform ios --profile production` 是当前项目已验证可用的生产构建路径
- `eas submit` 在本项目里曾出现过“submission 创建成功但最终 `ERRORED` 且无明确错误”的情况
- 如果再次遇到这种情况，直接按 `docs/ios-release.md` 中记录的 `altool` / Transporter 回退方案处理，不要在同一条 EAS submit 链路上反复重试

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

## Web 回归基线

- 回归说明：`docs/test-baseline.md`
- 脚本目录：`qa/`
- 结果目录：`qa/artifacts/`
- 一键执行：`npm run qa:baseline`

## 新人上手流程

这一节只写新成员最容易卡住、且本项目已经验证过能走通的流程。

### 1. 本地启动并连接数据库

先安装依赖并准备 `.env`：

```bash
npm install
cp .env.example .env
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

如果需要把 Android 包提交到 Google Play，还需要维护者提供 `credentials/android/service-account.json`，该文件只应保存在本机的 `credentials/android/` 目录。

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

如果需要提交到 App Store Connect，仓库不会保存以下信息，必须单独向维护者索取：

1. Apple Developer 登录邮箱 `appleId`
2. App Store Connect 的 `ascAppId`
3. Apple Team ID `appleTeamId`
4. 如需本地签名，还需要 `credentials.json`、证书文件和描述文件

推荐做法是先把这些值填进本地 `.env.release.local`，提交前在当前 shell 中加载：

```bash
set -a
source .env.release.local
set +a
```

然后再执行：

```bash
eas submit --platform ios --profile production
```

说明：

- `EXPO_APPLE_ID` 可直接作为 EAS Submit 环境变量使用
- `ASC_APP_ID`、`APPLE_TEAM_ID` 建议作为本地发布记录保存，供提审时填写或校验
- 这些值都不要写回仓库中的 `eas.json`

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
