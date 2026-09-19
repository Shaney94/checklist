-- Existing feeds deliberately remain unlinked. Names are not evidence of ownership.
ALTER TABLE turnli_calendars ADD COLUMN IF NOT EXISTS property_id text;
CREATE INDEX IF NOT EXISTS turnli_calendars_property ON turnli_calendars(owner_id,property_id) WHERE property_id IS NOT NULL;
