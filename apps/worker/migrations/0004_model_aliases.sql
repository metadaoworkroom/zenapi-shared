CREATE TABLE IF NOT EXISTS model_aliases (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS model_aliases_alias ON model_aliases(alias);
CREATE INDEX IF NOT EXISTS model_aliases_model_id ON model_aliases(model_id);
