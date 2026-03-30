# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Morangos is a Portuguese-language (pt-BR) business management system for a strawberry farm. It handles orders, deliveries, clients, products, promotions, recurring orders, supplier accounts, and route optimization. All UI text is in Brazilian Portuguese.

**Version:** 2.0.2
**Repo:** github.com/gtorige/morangos (private)
**Branches:** `main` (local install), `cloud` (Vercel + Turso deploy)
**Cloud URL:** https://morangos-wheat.vercel.app

## Commands

```bash
npm run dev          # Start dev server (port 3000, 0.0.0.0)
npm run build        # Production build
npm run lint         # ESLint
npm run db:migrate   # Prisma migrate dev
npm run db:seed      # Seed database (node prisma/seed.js)
npm run db:reset     # Reset database
npx prisma db push   # Push schema changes (use --skip-generate if server is running)
npx prisma generate  # Regenerate Prisma client (stop dev server first)
```

**Important:** On this Windows machine, `npx` requires `export PATH="/c/Program Files/nodejs:$PATH"` prepended to commands.

## Tech Stack

- **Next.js 16.2.1** (app router) + **React 19** + **TypeScript 5**
- **Prisma 5.22** + **SQLite** (file: `prisma/dev.db`) or **Turso** (cloud branch)
- **Tailwind CSS 4** with oklch color variables (Apple Dark theme)
- **@base-ui/react** + shadcn-style components (CVA variants)
- **NextAuth v5** (beta) with Credentials provider + JWT sessions
- **Zod 4** for API validation
- **Google Routes API** for delivery route optimization

## Architecture

### Pages (all "use client")
All pages are client components using `useState`/`useEffect` with direct `fetch()` to API routes. No server components or SSR patterns.

### API Routes (`src/app/api/`)
REST-style Route Handlers: GET (list/filter), POST (create), PUT (update), DELETE (remove). Parameters via `params: Promise<{ id: string }>` (Next.js 16 async params pattern). All routes use `withAuth()` wrapper from `src/lib/api-helpers.ts` and Zod validation via `parseBody()`.

### Database
15 Prisma models mapped to Portuguese table names via `@@map()`. Dates stored as ISO strings (`YYYY-MM-DD`), not Date objects. Prisma singleton in `src/lib/prisma.ts`.

Key models: `Pedido` (orders), `PedidoRecorrente` (recurring templates), `Cliente`, `Produto`, `Promocao`, `Conta`, `Fornecedor`.

### Shared Libraries (`src/lib/`)
- `api-helpers.ts` — `withAuth()`, `parseBody()`, `parseId()`, `ApiError`, centralized Prisma error handling
- `schemas.ts` — Zod schemas for all models
- `types.ts` — Shared TypeScript interfaces
- `constants.ts` — `PEDIDO_INCLUDE`, `RECORRENTE_INCLUDE`, status enums
- `formatting.ts` — `formatPrice()`, `formatDate()`, `todayStr()`, `addDays()`, `formatPhone()`
- `services/pedido-service.ts` — Order processing with promotions, recurring order generation

### Components (`src/components/ui/`)
Shadcn-style components using @base-ui/react primitives. Custom shared components: `StatusBadge`, `TabsNav`, `EmptyState`, `Skeleton`, `Breadcrumb`. Card component has `overflow-hidden` removed intentionally (for dropdown visibility).

### Authentication
- `auth.config.ts` — Edge-safe config (NO prisma imports, for middleware)
- `auth.ts` — Full config with prisma (for API routes, Node.js runtime)
- `middleware.ts` — Uses `auth.config.ts` only (Edge Runtime compatible)
- `/api/login` — Custom login endpoint that sets JWT cookie
- Login works on both localhost and IP address (`trustHost: true`, `useSecureCookies: false`)

### Cloud Branch (`cloud`)
Uses Vercel + Turso instead of local SQLite:
- `prisma.ts` has Turso adapter with fetch shim for `/v1/jobs` probe bug
- `auth.config.ts` split pattern to keep Edge middleware clean
- `vercel.json` forces `--webpack` (Turbopack middleware.js.nft.json bug)
- `serverExternalPackages` for `@libsql/client`, `@prisma/adapter-libsql`
- Versions pinned: `@prisma/adapter-libsql@5.22.0`, `@libsql/client@0.6.2`

## Key Patterns

- **Status values:** Payment: `"Pendente" | "Pago"`. Delivery: `"Pendente" | "Em rota" | "Entregue" | "Cancelado"`
- **Price display:** `R$ X,XX` format (Brazilian). Use `formatPrice()` from `src/lib/formatting.ts`
- **Date display:** `DD/MM/YYYY` (Brazilian). Stored as `YYYY-MM-DD` strings. Use `formatDate()`
- **Phone format:** `(XX) XXXXX-XXXX` mask applied on input and display
- **Filters:** Auto-apply on change with 300ms debounce (no submit button). Period saved in localStorage.
- **Promotions:** 4 types: `desconto`, `leve_x_pague_y`, `quantidade_minima`, `compra_parceira`. Priority: quantidade_minima (best tier) > desconto > leve_x_pague_y > compra_parceira. Multiple quantidade_minima tiers supported (picks best matching).
- **Recurring orders:** On create/edit, all future pending orders are auto-generated/regenerated. Manual price override per item via `precoManual` field. Selective deletion dialog on delete.
- **Route optimization:** Google Routes API called server-side (`/api/rota/otimizar`), API key in `.env` or DB config
- **Mobile:** Responsive with `hidden sm:table-cell` for table columns, compact cards on mobile, overflow menu for actions
- **Empty states:** Use `EmptyState` component with icon + CTA
- **Loading:** Use `TableSkeleton` / `CardSkeleton` components
- **Table actions:** Double-click to edit, only delete icon in action column
- **Notification banner:** Collapsible, persisted in localStorage

## Environment Variables

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="random-32-char-string"
GOOGLE_ROUTES_API_KEY="..." (optional)

# Cloud only (branch cloud):
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="eyJ..."
```

## Conventions

- All user-facing text must be in Portuguese (pt-BR) with proper accents (ç, ã, é, etc.)
- Font: Inter (loaded via `next/font/google`, variable `--font-inter` on `<html>`)
- Theme: Apple Dark (pure neutral dark, subtle blue accent) — colors defined in `globals.css` `:root`
- Tables hide less important columns on mobile (`hidden sm:table-cell`, `hidden md:table-cell`)
- Use shared components from `src/components/ui/` (StatusBadge, TabsNav, EmptyState, etc.)
- Use shared types from `src/lib/types.ts` and formatting from `src/lib/formatting.ts`
- API routes use `withAuth()` + `parseBody()` + Zod schemas from `src/lib/schemas.ts`

## Installers

- `install.ps1` — Local install/update/uninstall (PowerShell, Windows)
- `deploy-cloud.ps1` — Cloud deploy to Vercel + Turso (branch `cloud`)
- Both support backup to `Documentos/MorangosBackups/`

## Known Issues / Workarounds

- **Turbopack + middleware:** Build on Vercel requires `--webpack` flag (Turbopack generates missing `middleware.js.nft.json`)
- **@libsql/client 0.6.x probe:** Turso AWS endpoints return 400 on `/v1/jobs` probe. Workaround: fetch shim in `prisma.ts` (cloud branch)
- **PowerShell encoding:** Use `[System.IO.File]::WriteAllText()` with `UTF8Encoding($false)` to avoid BOM issues
- **PowerShell NativeCommandError:** Wrap `npx` calls in `cmd /d /c` to suppress false red errors
