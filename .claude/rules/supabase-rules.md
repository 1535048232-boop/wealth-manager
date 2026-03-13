# Supabase Rules

## Security
- RLS (Row Level Security) must be enabled on ALL tables
- Never expose service role key in client code
- Use `EXPO_PUBLIC_SUPABASE_ANON_KEY` only in client

## Database Naming
- Tables: snake_case plural (`user_profiles`, `transactions`)
- Columns: snake_case (`created_at`, `user_id`)
- Foreign keys: `{table_singular}_id` pattern
- Always include `id`, `created_at`, `updated_at` on every table

## Auth
- Use `supabase.auth` methods only — never manipulate auth state directly
- Session is managed by `authStore` — don't call `getSession` outside of `initialize()`
- Always check `session` before making authenticated requests

## Queries
- All Supabase calls go through `lib/supabase.ts` client
- Use `useSupabaseQuery` hook for data fetching in components
- Always destructure `{ data, error }` and handle both

## Edge Functions
- Located in `supabase/functions/`
- Use Deno runtime
- Always validate request body with Zod
- Return consistent `{ data, error }` shape

## Migrations
- Located in `supabase/migrations/`
- Never edit existing migration files
- Run `npx supabase db push` to apply
- Generate types after schema changes: `npx supabase gen types typescript --local > types/supabase.ts`
