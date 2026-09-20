-- Existing hashes and assignments remain valid. Old one-way codes require an
-- explicit replacement before they can be displayed; never rotate on a read.
ALTER TABLE turnli_cleaner_codes ADD COLUMN IF NOT EXISTS encrypted_code text;
