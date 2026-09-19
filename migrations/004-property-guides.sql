-- Sensitive operational instructions are intentionally outside the shared checklist document.
CREATE TABLE IF NOT EXISTS turnli_property_guides (
 owner_id text NOT NULL REFERENCES turnli_dashboard(owner_id) ON DELETE CASCADE,
 property_id text NOT NULL,
 revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
 guide jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(guide) = 'object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (owner_id, property_id)
);
