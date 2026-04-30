# iOS 发布说明

本文档只覆盖 iOS 发布、签名、提交 TestFlight / App Store 的本地准备流程。

## 目标

保证以下三件事同时成立：

1. 发布必需配置保留在本机
2. 真实敏感信息不进入 GitHub
3. 新开发者知道自己缺哪些文件和值

## 本地必备文件

按用途分为两类。

### 1. iOS 提审

需要本地文件：

- `.env.release.local`

基于模板创建：

```bash
cp .env.release.local.example .env.release.local
```

需要维护者提供的值：

- `EXPO_APPLE_ID`
- `ASC_APP_ID`
- `APPLE_TEAM_ID`
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`（仅在当前提交流程需要时提供）

推荐写法：

```bash
EXPO_APPLE_ID=your-apple-id@example.com
ASC_APP_ID=1234567890
APPLE_TEAM_ID=AB12XYZ34S
EXPO_APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 2. 本地签名 / 本地 EAS 构建

需要本地文件：

- `credentials.json`
- `credentials/ios/dist-cert.p12`
- `credentials/ios/profile.mobileprovision`

基于模板创建：

```bash
cp credentials.example.json credentials.json
mkdir -p credentials/ios
```

需要维护者提供的内容：

- iOS distribution certificate 文件
- certificate password
- provisioning profile 文件

## 提审前检查

运行：

```bash
npm run check:local-config -- ios-submit
```

如果还要做本地签名或本地 iOS 构建，再运行：

```bash
npm run check:local-config -- ios-build
```

## 加载本地提审配置

在当前 shell 中加载 `.env.release.local`：

```bash
set -a
source .env.release.local
set +a
```

这样做的目的：

- `EXPO_APPLE_ID` 可以直接被 EAS Submit 读取
- 其他字段可以作为提审核对信息保存在本机

## 常用命令

### 1. 构建生产包

```bash
npx eas-cli build --profile production --platform ios
```

### 2. 提交最新构建

```bash
set -a
source .env.release.local
set +a

npx eas-cli submit --profile production --platform ios --latest
```

### 3. 提交指定构建

```bash
set -a
source .env.release.local
set +a

npx eas-cli submit --profile production --platform ios --id <BUILD_ID>
```

## 接手仓库时的最短路径

如果只是要开发，不需要发布：

1. 创建 `.env`
2. 向维护者索取 Supabase 相关值
3. 运行 `npm run check:local-config -- dev`

如果要提审 iOS：

1. 创建 `.env.release.local`
2. 向维护者索取 Apple 提审相关值
3. 运行 `npm run check:local-config -- ios-submit`
4. 加载 `.env.release.local`
5. 执行 `eas submit`

如果要本地签名或本地 iOS 构建：

1. 创建 `credentials.json`
2. 补齐 `credentials/ios/` 下的真实签名文件
3. 运行 `npm run check:local-config -- ios-build`

## 不要提交的内容

以下内容只应存在于本机：

- `.env`
- `.env.release.local`
- `credentials.json`
- `credentials/`
- 任意 Apple 密码、证书密码、Google Service Account JSON

如果你已经误提交过这些信息，不要只删文件，还应尽快轮换凭证。