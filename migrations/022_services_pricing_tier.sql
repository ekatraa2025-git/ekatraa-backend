-- Optional display label for catalog tier (Basic, Classic Value, etc.) on vendor services rows
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_tier TEXT;
