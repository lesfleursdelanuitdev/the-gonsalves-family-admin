# The Gonsalves Family

A family history and genealogy project built with:

- **Next.js** – React framework with App Router
- **Tailwind CSS** – Utility-first styling
- **TanStack React Query** – Data fetching and caching
- **D3.js** – Data visualization (charts, family trees, etc.)

## Getting started

**Development:**
```bash
npm run dev
```
Uses Turbopack (default). If you see 404 or module errors, try `npm run dev:webpack` or `npm run build && npm run start:prod`.

**Production (recommended for local testing):**
```bash
npm run build && npm run start:prod
```
Opens on [http://localhost:3039](http://localhost:3039).

## Database (read-only)

This app uses the shared `@ligneous/prisma` package to read from the `ligneous_frontend` database. Use a read-only database user.

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
2. Ensure the read-only user exists (see `docs/read-only-db-user.md`).

## Images

- **Local images** stay in `public/images/` (crest, hero, journey photos, etc.).
- **Ligneous images**: set `NEXT_PUBLIC_LIGNOUS_FRONTEND_URL` (e.g. `http://localhost:4000`) to access images from ligneous-frontend. Use `ligneousImage(path)` or `resolveImageUrl("ligneous:/images/...")` from `lib/images.ts`.

## Scripts

- `npm run dev` – Start development server
- `npm run build` – Build for production
- `npm run start` – Start production server
- `npm run lint` – Run ESLint
