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

### 2.1 已验证的上传路径（2026-05-03）

这次已经实际验证过的结论：

1. `eas build --platform ios --profile production --non-interactive` 可以正常产出 production IPA
2. `eas submit --platform ios --profile production --latest --non-interactive` **不一定可靠**
3. 当前项目里遇到过的真实情况是：
   - EAS 能成功创建 submission
   - submission 状态变成 `ERRORED`
   - Expo / EAS 没返回可读错误，`error` 甚至可能是 `null`
4. 遇到这种情况时，**不要反复重试同一条 EAS submit 命令浪费时间**，直接切到 Apple 官方上传工具

推荐顺序：

1. 先用 EAS 构建 production 包
2. 如果 `eas submit` 一次成功，就继续用它
3. 如果 `eas submit` 已经出现“scheduled 但最终 errored 且没有明确错误”：
   - 立刻改用 `altool` 或 Transporter
   - 不要再把时间花在 Expo submission 黑盒上

### 2.2 `eas submit` 失败时的官方回退方案

如果 EAS submit 失败，但 IPA 已经构建成功，优先走 Apple 官方上传：

- **方案 A：Transporter**
- **方案 B：`xcrun altool`**

两种方式本质上都要求你手里有：

- IPA 文件
- App Store Connect API Key ID
- API Issuer ID
- 对应私钥 `AuthKey_<KEY_ID>.p8`

这些内容都只保留在本机，不进仓库。

#### 用 `altool` 上传

先准备一个仅本机使用的私钥目录：

```bash
mkdir -p ~/private_keys
cp /path/to/AuthKey_<KEY_ID>.p8 ~/private_keys/
```

或者使用自定义目录，但要通过环境变量显式告诉 `altool`：

```bash
export API_PRIVATE_KEYS_DIR=/path/to/private_keys
```

然后上传：

```bash
xcrun altool \
  --upload-app \
  --file /path/to/app.ipa \
  --type ios \
  --api-key <KEY_ID> \
  --api-issuer <ISSUER_ID> \
  --verbose
```

成功时会看到类似结果：

```text
UPLOAD SUCCEEDED with no errors
Delivery UUID: <UUID>
```

看到这个就说明包已经进入 App Store Connect，后续只需要等 Apple 处理成 `PROCESSING` / 可见构建。

#### 为什么这条回退路径重要

因为这次项目已经实际遇到过：

- EAS build 成功
- EAS submit 多次 `ERRORED`
- GraphQL submission 记录里只有状态，没有可读错误信息
- `altool` 直接上传同一个 IPA 却一次成功

以后遇到同类现象，默认判断为：

**不是包本身一定有问题，而是 EAS submit 这条链路不够透明。**

优先切 Apple 官方工具，定位和交付都会更快。

### 3. 提交指定构建

```bash
set -a
source .env.release.local
set +a

npx eas-cli submit --profile production --platform ios --id <BUILD_ID>
```

如果你已经有 IPA 文件，也可以不依赖 EAS submit，直接用上面的 `altool`/Transporter 路径上传。

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
5. 先执行 `eas build --platform ios --profile production`
6. 再执行 `eas submit`
7. 如果 `eas submit` 无明确错误却反复失败，立刻切 `altool` / Transporter

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
- `AuthKey_<KEY_ID>.p8`
- 任意 `private_keys/` 目录中的 App Store Connect API 私钥

如果你已经误提交过这些信息，不要只删文件，还应尽快轮换凭证。
