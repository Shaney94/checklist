-- Properties remain in turnli_dashboard. Jobs refer to that workspace's property IDs.
CREATE TABLE IF NOT EXISTS turnli_cleaner_codes (
 user_id text PRIMARY KEY,
 code_hash text NOT NULL UNIQUE,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS turnli_cleaning_jobs (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL REFERENCES turnli_dashboard(owner_id) ON DELETE CASCADE,
 property_id text NOT NULL,
 scheduled_date date NOT NULL,
 kind text NOT NULL CHECK (kind IN ('regular','deep')),
 state text NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','cancelled')),
 cleaner_user_id text REFERENCES turnli_cleaner_codes(user_id),
 tasks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tasks)='array'),
 checked jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checked)='array'),
 revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS turnli_jobs_workspace ON turnli_cleaning_jobs(owner_id,scheduled_date,id);
CREATE INDEX IF NOT EXISTS turnli_jobs_cleaner ON turnli_cleaning_jobs(cleaner_user_id,scheduled_date,id) WHERE state='scheduled';
