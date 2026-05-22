# Project Guidelines

## Build And Release

- When the user asks to build, package, release, publish, or submit the mobile app without explicitly limiting the platform, default to building both Android and iOS.
- For those requests, prefer the workflow defined in [.github/prompts/build-mobile-both.prompt.md](./prompts/build-mobile-both.prompt.md).
- Default command behavior: use `npx eas-cli build --platform all --profile production` unless the user explicitly specifies another profile, platform, or EAS flag.
- After build completion, always return the Android and iOS build links in the chat response.
- If the iOS build succeeds and the request is not local-only, simulator-only, or clearly for internal preview only, default to submitting the iOS build to App Store Connect.
- Before iOS submit, follow [docs/ios-release.md](../docs/ios-release.md) and verify `.env.release.local` and required Apple submission credentials are available.
- If credentials, environment variables, login state, or submission prerequisites are missing, state the blocking item directly and still return any available build links.

## References

- General project setup and commands: [README.md](../README.md)
- iOS submit process: [docs/ios-release.md](../docs/ios-release.md)
- Reusable build prompt: [.github/prompts/build-mobile-both.prompt.md](./prompts/build-mobile-both.prompt.md)