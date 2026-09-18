CREATE TABLE IF NOT EXISTS turnli_calendars (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL,
 display_name text NOT NULL,
 platform text NOT NULL DEFAULT 'Custom iCal',
 feed_host text NOT NULL,
 encrypted_url text NOT NULL,
 url_hash text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 check_in time NOT NULL DEFAULT '15:00',
 check_out time NOT NULL DEFAULT '10:00',
 bookings jsonb NOT NULL DEFAULT '[]',
 revision integer NOT NULL DEFAULT 1,
 last_attempt timestamptz,
 last_success timestamptz,
 sync_error text,
 lease_id uuid,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,url_hash)
);
CREATE INDEX IF NOT EXISTS turnli_calendars_owner ON turnli_calendars(owner_id);
CREATE INDEX IF NOT EXISTS turnli_calendars_due ON turnli_calendars(last_attempt) WHERE enabled;
