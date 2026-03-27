# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Morangos is a Portuguese-language (pt-BR) business management system for a strawberry farm. It handles orders, deliveries, clients, products, promotions, recurring orders, supplier accounts, and route optimization. All UI text is in Brazilian Portuguese.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
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

- **Next.js 16** (app router) + **React 19** + **TypeScript 5**
- **Prisma 5** + **SQLite** (file: `prisma/dev.db`)
- **Tailwind CSS 4** with oklch color variables (Apple Dark theme)
- **@base-ui/react** + shadcn-style components (CVA variants)
- **Google Routes API** for delivery route optimization

## Architecture

### Pages (all "use client")
All pages are client components using `useState`/`useEffect` with direct `fetch()` to API routes. No server components or SSR patterns.

### API Routes (`src/app/api/`)
REST-style Route Handlers: GET (list/filter), POST (create), PUT (update), DELETE (remove). Parameters via `params: Promise<{ id: string }>` (Next.js 16 async params pattern).

### Database
11 Prisma models mapped to Portuguese table names via `@@map()`. Dates stored as ISO strings (`YYYY-MM-DD`), not Date objects. Prisma singleton in `src/lib/prisma.ts`.

Key models: `Pedido` (orders), `PedidoRecorrente` (recurring templates), `Cliente`, `Produto`, `Promocao`, `Conta`, `Fornecedor`.

### Components (`src/components/ui/`)
Shadcn-style components using @base-ui/react primitives. Card component has `overflow-hidden` removed intentionally (for dropdown visibility).

## Key Patterns

- **Status values:** Payment: `"Pendente" | "Pago"`. Delivery: `"Pendente" | "Em rota" | "Entregue" | "Cancelado"`
- **Price display:** `R$ X,XX` format (Brazilian). Use `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`
- **Date display:** `DD/MM/YYYY` (Brazilian). Stored as `YYYY-MM-DD` strings
- **Phone format:** `(XX) XXXXX-XXXX` mask applied on input and display
- **Filters:** Auto-apply on change with 300ms debounce (no submit button)
- **Recurring orders:** On create/edit, all future pending orders are auto-generated/regenerated. Manual price override per item via `precoManual` field
- **Route optimization:** Google Routes API called server-side (`/api/rota/otimizar`), API key in `.env` as `GOOGLE_ROUTES_API_KEY`
- **Mobile:** Responsive with `hidden sm:table-cell` for table columns, stacked layouts on mobile, hamburger menu via Sheet component

## Environment Variables

```
DATABASE_URL="file:./dev.db"
GOOGLE_ROUTES_API_KEY="..."
```

## Conventions

- All user-facing text must be in Portuguese (pt-BR) with proper accents (ç, ã, é, etc.)
- Font: Inter (loaded via `next/font/google`, variable `--font-inter` on `<html>`)
- Theme: Apple Dark (pure neutral dark, subtle blue accent) — colors defined in `globals.css` `:root`
- Tables hide less important columns on mobile (`hidden sm:table-cell`, `hidden md:table-cell`)
