# Coding Standards

## TypeScript
- Strict mode enabled — no `any`, no `as unknown`
- Prefer `interface` over `type` for object shapes
- All async functions must have try-catch
- Use `const` by default, `let` only when reassignment is needed

## React Native Components
- Function declarations only: `export function Foo()` not `export const Foo = () =>`
- One component per file
- Props interface defined above the component
- No class components

## File Organization
- Barrel exports via `index.ts` in each component folder
- Co-locate component-specific types in the same file
- Shared types go in `types/`

## Naming
- Components: PascalCase (`UserCard.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Stores: camelCase with `Store` suffix (`authStore.ts`)
- Constants: SCREAMING_SNAKE_CASE for values, PascalCase for objects

## Error Handling
- Always handle errors from Supabase calls
- Show user-facing error messages in the UI
- Log errors to console in development only
