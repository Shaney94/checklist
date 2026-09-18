CREATE TABLE IF NOT EXISTS turnli_dashboard (
 owner_id text PRIMARY KEY,
 revision integer NOT NULL DEFAULT 0,
 data jsonb NOT NULL DEFAULT '{"properties":[]}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
