# Mastra + planning API deployment

## Environment

| Variable                                | Purpose                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` | Mastra `anthropic/*` models                                                                                                                                                  |
| `CLAUDE_MODEL`                          | Optional; default `claude-sonnet-4-6`                                                                                                                                        |
| `MASTRA_LIBSQL_URL`                     | **Production:** Turso `libsql://…` URL or local `file:./mastra.local.db`. Defaults to **`:memory:`** (ephemeral; fine for CI, not for durable chat on Vercel).                 |
| `MASTRA_LIBSQL_AUTH_TOKEN`              | **Required with Turso** when `MASTRA_LIBSQL_URL` is `libsql://…`. Omit for `file:` and `:memory:`.                                                                          |
| `EKATRAA_WEB_ORIGINS`                   | Comma-separated origins allowed for CORS on planning/voice APIs (e.g. `https://www.ekatraa.in,https://ekatraa.in,http://localhost:3001`).                                    |
| `VAPI_WEBHOOK_SECRET`                   | Optional HMAC secret for `/api/public/vapi/webhook` signature checks.                                                                                                        |

## Turso setup (production memory)

Mastra stores chat threads and agent memory in LibSQL. On Vercel you need a **remote** database — the filesystem is ephemeral.

### 1. Create a Turso database

Install the [Turso CLI](https://docs.turso.tech/cli), then:

```bash
turso auth login
turso db create ekatraa-mastra
turso db show ekatraa-mastra --url
turso db tokens create ekatraa-mastra
```

Save the **URL** (`libsql://…turso.io`) and **token** from the last two commands.

### 2. Local development

In `ekatraa_backend/.env.local`:

```env
# Option A — local SQLite file (default for dev)
MASTRA_LIBSQL_URL=file:./mastra.local.db

# Option B — same Turso DB as production (good for testing remote memory)
MASTRA_LIBSQL_URL=libsql://ekatraa-mastra-yourorg.turso.io
MASTRA_LIBSQL_AUTH_TOKEN=eyJhbG...
```

Restart `npm run dev` after changing env vars.

### 3. Vercel (ekatraa_backend)

In **Project → Settings → Environment Variables**, add for **Production** (and Preview if needed):

| Variable | Example |
| -------- | ------- |
| `MASTRA_LIBSQL_URL` | `libsql://ekatraa-mastra-yourorg.turso.io` |
| `MASTRA_LIBSQL_AUTH_TOKEN` | *(token from `turso db tokens create`)* |
| `EKATRAA_WEB_ORIGINS` | `https://www.ekatraa.in,https://ekatraa.in` |

Redeploy after saving. Do **not** use `file:./…` on Vercel.

### 4. Verify

```bash
# Should return [] or prior messages — not 500
curl -s \
  -H "Origin: https://www.ekatraa.in" \
  "https://ekatraa-backend.vercel.app/api/public/ai/planning/chat?thread=smoke-test"
```

Send a message in the web chat, reload, and confirm history persists across refreshes.

## Vercel / serverless

- Prefer **Turso** (`libsql://…` + `MASTRA_LIBSQL_AUTH_TOKEN`) so agent memory survives cold starts and scales horizontally.
- Watch **function duration** and **streaming** for long agent turns; split heavy work into tools that stay fast or use async jobs for vendor matching at scale.
- Enable Mastra **tracing** in the Mastra dashboard/docs when you want production observability.

## Local Studio

```bash
npm run mastra:dev
```

Opens Mastra Studio (see [Mastra quickstart](https://mastra.ai/guides/getting-started/quickstart)) against this project’s `src/mastra` config.

## Routes

- `POST/GET /api/public/ai/planning/chat` — customer Mastra agent (AI SDK UI v6 stream).
- `POST /api/public/ai/planning/workflow/intake` — intake workflow stream.
- `POST /api/public/vapi/webhook` — Vapi stub (extend to invoke Mastra).
- `POST/GET /api/vendor/ai/planning/chat` — vendor agent; requires `Authorization: Bearer` (Supabase vendor JWT).
