-- Up Migration

CREATE TABLE import_log (
  id              serial PRIMARY KEY,
  entity          text NOT NULL CHECK (entity IN ('room', 'booking')),
  source_property text NOT NULL,
  issue           text NOT NULL,
  action          text NOT NULL CHECK (action IN ('normalized', 'converted', 'repaired', 'quarantined')),
  raw             jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_log_issue ON import_log (issue, action);

-- Down Migration

DROP TABLE IF EXISTS import_log;