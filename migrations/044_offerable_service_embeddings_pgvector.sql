-- pgvector + semantic match RPC for offerable services (embeddings populated by a separate job).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.offerable_service_embeddings (
  service_id uuid PRIMARY KEY REFERENCES public.offerable_services (id) ON DELETE CASCADE,
  embedding vector(1536),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offerable_service_embeddings_ivfflat_idx
  ON public.offerable_service_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE OR REPLACE FUNCTION public.match_offerable_services_semantic(
  query_embedding vector(1536),
  match_count int DEFAULT 8
)
RETURNS TABLE (service_id uuid, similarity double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.service_id,
    (1 - (e.embedding <=> query_embedding))::double precision AS similarity
  FROM public.offerable_service_embeddings e
  WHERE e.embedding IS NOT NULL
  ORDER BY e.embedding <-> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 50);
$$;

COMMENT ON TABLE public.offerable_service_embeddings IS '1536-d embeddings for semantic search; backfill via admin/cron script.';
