# Ekatraa backend

Next.js (App Router) API and admin for Ekatraa: Supabase-backed catalog and orders, Razorpay flows, AI planning (Mastra / Gemini / OpenRouter), and internal admin tools.

## Requirements

- Node.js 20+
- A Supabase project (URL + anon key + **service role** key for server routes)

Install dependencies (pick one package manager and stick with it):

```bash
pnpm install
```

## Environment variables

Create a local `.env` (never commit real secrets). Names commonly used in this repo:

| Area | Variables |
|------|-----------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Payments** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (public payment routes) |
| **AI / Mastra** | `GEMINI_API_KEY` or `GOOGLE_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`; optional `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `MASTRA_LIBSQL_URL` |
| **Planning CORS** | `EKATRAA_WEB_ORIGINS` (comma-separated); optional `EKATRAA_WEB_ORIGINS_STRICT=1` |
| **Admin login** | `ADMIN_LOGIN_RSA_PRIVATE_KEY`, `ADMIN_LOGIN_RSA_PUBLIC_KEY` (see `src/app/api/auth/login`) |
| **Default vendor seed** | Optional `DEFAULT_VENDOR_EMAIL`, `DEFAULT_VENDOR_PASSWORD`, `DEFAULT_VENDOR_PHONE` (10-digit Indian number; defaults exist for demos only — override in production) |

Server Supabase usage is wired in `src/lib/supabase/server.ts` (service role).

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build and run |
| `pnpm lint` | ESLint |
| `pnpm test` | Cart/order lifecycle checks (`tests/cart-order-lifecycle.mjs`) |
| `pnpm seed` | Offerable services seed script |
| `pnpm mastra:dev` | Mastra dev server |

## Notable features

- **Admin vendors**: create/update accepts either a real catalog UUID for `category_id` or a legacy slug-style id (for example `venue-menu`). Resolution happens in `src/lib/vendor-category-resolve.ts` before writes to `vendors.category_id`.
- **Default demo vendor**: `POST /api/admin/seed/default-vendor` ensures an Auth user plus a matching `vendors` row (idempotent). The admin vendors screen can call this for onboarding demos; configure credentials with `DEFAULT_VENDOR_*` env vars.

## Deploy

Designed for [Vercel](https://vercel.com): mirror the same environment variables in the project settings. Use production-safe secrets for Supabase and Razorpay; **rotate** any keys that were ever committed or shared.

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
