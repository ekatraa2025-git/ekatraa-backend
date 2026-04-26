# Mastra + planning API deployment

## Environment

| Variable                                | Purpose                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` | Mastra `anthropic/*` models                                                                                                                                                  |
| `CLAUDE_MODEL`                          | Optional; default `claude-sonnet-4-6`                                                                                                                                        |
| `MASTRA_LIBSQL_URL`                     | **Production:** Turso/libsql URL or `file:/path/to/mastra.db`. Defaults to **`:memory:`** (ephemeral per instance; fine for CI, not for durable chat history on multi-node). |
| `EKATRAA_WEB_ORIGINS`                   | Comma-separated origins allowed for CORS on `/api/public/ai/planning/*` (e.g. `https://www.ekatraa.in,http://localhost:3001`).                                               |
| `VAPI_WEBHOOK_SECRET`                   | Optional HMAC secret for `/api/public/vapi/webhook` signature checks.                                                                                                        |

## Vercel / serverless

- Prefer **Turso** (`libsql://…`) for `MASTRA_LIBSQL_URL` so agent memory survives cold starts and scales horizontally.
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
