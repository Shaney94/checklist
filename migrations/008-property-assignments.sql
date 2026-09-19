CREATE TABLE IF NOT EXISTS turnli_property_assignments (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL REFERENCES turnli_dashboard(owner_id) ON DELETE CASCADE,
 property_id text NOT NULL,
 invited_email text NOT NULL,
 cleaner_user_id text,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','active','revoked','declined')),
 delivery text NOT NULL DEFAULT 'pending' CHECK (delivery IN ('pending','sent','failed')),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_at timestamptz,
 revoked_at timestamptz,
 CHECK (state<>'active' OR cleaner_user_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS turnli_property_assignment_current ON turnli_property_assignments(owner_id,property_id) WHERE state IN ('pending','active');
CREATE INDEX IF NOT EXISTS turnli_property_assignment_inbox ON turnli_property_assignments(invited_email) WHERE state='pending';
CREATE INDEX IF NOT EXISTS turnli_property_assignment_cleaner ON turnli_property_assignments(cleaner_user_id) WHERE state='active';
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS property_assignment_id uuid REFERENCES turnli_property_assignments(id);
CREATE OR REPLACE FUNCTION turnli_job_assignment_active(assignment_id uuid, workspace_id text, property text, cleaner text) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT assignment_id IS NULL OR EXISTS (SELECT 1 FROM turnli_property_assignments a WHERE a.id=assignment_id AND a.owner_id=workspace_id AND a.property_id=property AND a.cleaner_user_id=cleaner AND a.state=''active'')';
