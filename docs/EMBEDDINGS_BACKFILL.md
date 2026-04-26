# Backfill `offerable_service_embeddings`

After applying migration `044_offerable_service_embeddings_pgvector.sql`:

1. For each active `offerable_services` row, build a text blob (name, description, category).
2. Call your embedding model (e.g. OpenAI `text-embedding-3-large`, 1536 dimensions).
3. `INSERT ... ON CONFLICT (service_id) DO UPDATE` into `offerable_service_embeddings`.

Run as a one-off script or scheduled job when catalog changes; the Mastra tool `match_offerable_services_semantic` calls `match_offerable_services_semantic` RPC once rows exist.
