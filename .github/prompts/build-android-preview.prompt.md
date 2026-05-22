---
name: "Build Android Preview"
description: "构建安卓 preview 版安装包。适用于：打 preview 包、构建 Android preview、生成 Android APK 内测包。"
argument-hint: "可选：是否 non-interactive、是否 local、额外的 EAS 参数"
agent: "agent"
model: "GPT-5 (copilot)"
---

执行 Android preview 构建任务，默认只构建 Android，并使用 `preview` profile。

默认规则：
- 如果用户没有明确指定参数，默认使用 `npx eas-cli build --platform android --profile preview`
- 如果用户提供了 `--non-interactive`、`--local` 或其他 EAS 参数，优先使用用户参数
- 构建前先读取 [eas.json](../../eas.json)，确认 `preview` profile 的 Android 配置可用
- 构建前检查当前工作区是否在项目根目录，以及 EAS 登录状态是否正常
- 优先直接执行命令，不先输出大段方案说明

执行要求：
- 默认只构建 Android，不要附带 iOS
- 构建完成后默认回传 Android 构建链接；如果终端未直接给出链接，则继续用 `npx eas-cli build:list` 或等效方式补查最新构建链接
- 如果构建失败，优先给出直接阻塞原因

输出要求：
- 简短说明本次使用的参数
- 给出 Android preview 构建状态与对应链接
- 如果失败，明确说明失败原因