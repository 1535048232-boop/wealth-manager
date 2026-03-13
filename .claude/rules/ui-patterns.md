# UI Patterns

## Styling
- Use NativeWind `className` exclusively — never `StyleSheet.create`
- Follow Tailwind utility-first approach
- Use `cn()` helper if conditional classes get complex

## Component Props
- Always define a `className?: string` prop for layout overrides
- Use `children: React.ReactNode` for wrapper components
- Avoid passing style objects — use className strings

## Layout
- `ScreenWrapper` for all top-level screens (handles SafeAreaView)
- `flex-1` on screen root views
- `px-6` standard horizontal padding for content

## Responsive Design
- Design for mobile-first (375px base)
- Use `SCREEN_WIDTH` from `lib/utils.ts` for percentage-based sizing
- Avoid hardcoded pixel values — prefer Tailwind spacing scale

## Accessibility
- All interactive elements must have `accessibilityLabel`
- Use semantic roles where applicable
- Minimum touch target: 44x44pt
