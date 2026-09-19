ALTER TABLE turnli_cleaning_jobs DROP CONSTRAINT IF EXISTS turnli_cleaning_jobs_state_check;
ALTER TABLE turnli_cleaning_jobs ADD CONSTRAINT turnli_cleaning_jobs_state_check CHECK (state IN ('scheduled','cancelled','awaiting_review','approved','issue_reported'));
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS review_note text;
CREATE TABLE IF NOT EXISTS turnli_cleaning_job_photos (
 id uuid PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES turnli_cleaning_jobs(id) ON DELETE CASCADE,
 uploaded_by text NOT NULL,
 content_type text NOT NULL CHECK (content_type='image/jpeg'),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
 width integer NOT NULL CHECK (width BETWEEN 1 AND 1600),
 height integer NOT NULL CHECK (height BETWEEN 1 AND 1600),
 sha256 text NOT NULL,
 bytes bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (octet_length(bytes)=byte_size),
 UNIQUE(job_id,sha256)
);
CREATE INDEX IF NOT EXISTS turnli_cleaning_job_photos_job ON turnli_cleaning_job_photos(job_id,created_at,id);
