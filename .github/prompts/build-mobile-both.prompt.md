---
name: "Build Mobile Both"
description: "默认同时打包构建 Android 和 iOS 包，完成后回传构建链接，并在 iOS 成功后默认同步到 App Store Connect。适用于：打包 App、构建双端安装包、EAS 同时构建安卓和 iOS、提交 iOS 到 App Store Connect。"
argument-hint: "可选：profile、是否 non-interactive、是否 local、额外的 EAS 参数"
agent: "agent"
model: "GPT-5 (copilot)"
---

执行移动端打包任务，默认同时构建 Android 和 iOS，并在完成后回传构建链接。

默认规则：
- 如果用户没有明确指定参数，默认使用 `npx eas-cli build --platform all --profile production`
- 如果用户提供了 `profile`、`--non-interactive`、`--local` 或其他 EAS 参数，优先使用用户参数
- 构建前先读取 [eas.json](../../eas.json) 和 [docs/ios-release.md](../../docs/ios-release.md)，确认可用 profile、submit 约定和 iOS 提交流程
- 构建前检查当前工作区是否在项目根目录，以及 EAS 登录状态、本地凭据、环境变量是否满足当前构建与提交场景
- 如果本地或远端构建缺少凭据、环境变量或登录状态，先明确报出缺失项，再决定是否继续
- 优先直接执行命令，不先输出一大段方案说明

执行要求：
- 默认目标是双端一起构建，不要只构建单个平台，除非用户明确指定
- 优先使用最直接的 EAS 命令；只有在用户明确要求时才拆成两个单独命令
- 如果命令会长时间运行，使用异步终端并在返回时汇总关键输出
- 构建完成后，默认整理并回传 Android 和 iOS 的构建链接；如果终端未直接给出链接，则继续用 `npx eas-cli build:list` 或等效方式补查最新构建链接
- 如果 iOS 构建成功，且当前不是 `--local`、不是 simulator、不是明确仅内部预览用途，则默认继续同步到 App Store Connect
- iOS 同步默认遵循 [docs/ios-release.md](../../docs/ios-release.md)：必要时先加载 `.env.release.local`，再执行 `npx eas-cli submit --profile production --platform ios --latest`；如果本次不是 `production` profile，则先说明并跳过自动提交，除非用户明确要求
- 如果缺少 `.env.release.local`、Apple 账号参数或提交所需凭据，明确指出缺失项，并把 iOS 构建链接回传给用户，不要假装已提交成功
- 完成后汇报实际执行的命令、平台、profile、构建结果、构建链接、iOS 提交结果和下一步

输出要求：
- 简短说明本次使用的默认参数或用户覆盖参数
- 给出 Android 和 iOS 的构建状态与对应链接
- 如果执行了 iOS submit，给出 App Store Connect 同步状态
- 如果某一步失败，优先给出阻塞构建或提交的直接原因