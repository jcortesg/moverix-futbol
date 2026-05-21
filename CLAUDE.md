# Moverix Futbol

Monorepo pnpm 9 + Turbo 2. Gestión de torneos amateur.

## Stack
- **API**: NestJS 10 + Drizzle ORM + PostgreSQL + Firebase Admin — port 3001, prefix `/ftb/v1`
- **Admin**: Next.js 14 (App Router) + Tailwind 3 + Firebase Auth — port 3000
- **Mobile**: Expo 54 + React 19 + expo-router 6 + Firebase Auth + Zustand + React Query

## Mobile design tokens
- Dark UI: `#050B10` base, `#0F1F2B` card
- Verde: `#7BFF00` primary, glow `#7BFF00AA`
- Font: Rajdhani (700 heading, 500 body)
- Auth: `getAuth_safe()` via `lib/useAuth.ts` (lazy init, evita crash RN registration)

## Comandos
```bash
pnpm dev                    # admin + api
cd apps/mobile && pnpm dev  # expo start
```
