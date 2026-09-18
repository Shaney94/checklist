CREATE TABLE IF NOT EXISTS turnli_calendar_seen (
 owner_id text NOT NULL,
 user_id text NOT NULL,
 calendar_id uuid NOT NULL REFERENCES turnli_calendars(id) ON DELETE CASCADE,
 seen_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
 PRIMARY KEY(owner_id,user_id,calendar_id)
);
CREATE TABLE IF NOT EXISTS turnli_ui_preferences (
 owner_id text NOT NULL,
 user_id text NOT NULL,
 sidebar_collapsed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(owner_id,user_id)
);
