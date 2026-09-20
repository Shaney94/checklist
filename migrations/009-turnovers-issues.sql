ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS reservation_key text;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS planned_after time;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS reservation_arrival date;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS turnover_attention boolean NOT NULL DEFAULT false;
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS auto_cancelled boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS turnli_turnover_identity ON turnli_cleaning_jobs(owner_id,property_id,reservation_key) WHERE reservation_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS turnli_job_issues (
 id uuid PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES turnli_cleaning_jobs(id) ON DELETE CASCADE,
 reported_by text NOT NULL,
 category text NOT NULL CHECK(category IN ('damage','maintenance','supplies','access','other')),
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 2000),
 photo_bytes bytea,
 photo_width integer,
 photo_height integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((photo_bytes IS NULL AND photo_width IS NULL AND photo_height IS NULL) OR (photo_bytes IS NOT NULL AND octet_length(photo_bytes) BETWEEN 1 AND 2097152 AND photo_width BETWEEN 1 AND 1600 AND photo_height BETWEEN 1 AND 1600))
);
CREATE INDEX IF NOT EXISTS turnli_job_issues_job ON turnli_job_issues(job_id,created_at);
CREATE TABLE IF NOT EXISTS turnli_job_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id text NOT NULL,
 property_id text NOT NULL,
 job_id uuid NOT NULL REFERENCES turnli_cleaning_jobs(id) ON DELETE CASCADE,
 kind text NOT NULL,
 revision integer NOT NULL,
 scheduled_date date NOT NULL,
 state text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS turnli_job_events_job ON turnli_job_events(job_id,id);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION turnli_record_job_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_kind text;
BEGIN
 IF TG_OP='INSERT' THEN event_kind:='job.created';
 ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
  event_kind:=CASE NEW.state WHEN 'cancelled' THEN 'job.cancelled' WHEN 'awaiting_review' THEN 'clean.submitted' WHEN 'approved' THEN 'review.approved' WHEN 'issue_reported' THEN 'review.issue_reported' ELSE 'job.changed' END;
 ELSIF ROW(NEW.scheduled_date,NEW.planned_after,NEW.cleaner_user_id,NEW.property_assignment_id,NEW.turnover_attention) IS DISTINCT FROM ROW(OLD.scheduled_date,OLD.planned_after,OLD.cleaner_user_id,OLD.property_assignment_id,OLD.turnover_attention) THEN event_kind:='job.changed';
 ELSE RETURN NEW;
 END IF;
 INSERT INTO turnli_job_events(owner_id,property_id,job_id,kind,revision,scheduled_date,state) VALUES(NEW.owner_id,NEW.property_id,NEW.id,event_kind,NEW.revision,NEW.scheduled_date,NEW.state);
 RETURN NEW;
END $$;
-- statement-breakpoint
DROP TRIGGER IF EXISTS turnli_job_event ON turnli_cleaning_jobs;
CREATE TRIGGER turnli_job_event AFTER INSERT OR UPDATE ON turnli_cleaning_jobs FOR EACH ROW EXECUTE FUNCTION turnli_record_job_event();
-- statement-breakpoint
CREATE OR REPLACE FUNCTION turnli_reconcile_turnovers(workspace text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record; j turnli_cleaning_jobs%ROWTYPE; started boolean; seen_keys text[]:=ARRAY[]::text[];
BEGIN
 -- Existing creation/assignment operations also lock this canonical workspace.
 PERFORM 1 FROM turnli_dashboard WHERE owner_id=workspace FOR UPDATE;
 FOR r IN
  SELECT DISTINCT ON (c.property_id,b->>'id') c.property_id,b->>'id' AS reservation_key,
   (b->'arrival'->>'date')::date AS arrival,(b->'checkout'->>'date')::date AS checkout,
   CASE WHEN COALESCE((b->'checkout'->>'allDay')::boolean,false) THEN c.check_out ELSE NULLIF(b->'checkout'->>'time','')::time END AS checkout_time,
   a.id AS assignment_id,a.cleaner_user_id,p
  FROM turnli_calendars c JOIN turnli_dashboard d ON d.owner_id=c.owner_id
  CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
  CROSS JOIN LATERAL jsonb_array_elements(c.bookings) b
  JOIN turnli_property_assignments a ON a.owner_id=c.owner_id AND a.property_id=c.property_id AND a.state='active'
  WHERE c.owner_id=workspace AND p->>'id'=c.property_id AND b->>'id' IS NOT NULL
  ORDER BY c.property_id,b->>'id',c.last_success DESC NULLS LAST,c.id
 LOOP
  seen_keys:=array_append(seen_keys,r.property_id||':'||r.reservation_key);
  SELECT * INTO j FROM turnli_cleaning_jobs WHERE owner_id=workspace AND property_id=r.property_id AND reservation_key=r.reservation_key FOR UPDATE;
  IF NOT FOUND THEN
   -- Do not backfill historical stays or infer completed work from checkout.
   IF r.checkout >= (now() AT TIME ZONE 'Europe/London')::date THEN
    INSERT INTO turnli_cleaning_jobs(id,owner_id,property_id,scheduled_date,kind,tasks,cleaner_user_id,property_assignment_id,reservation_key,reservation_arrival,planned_after)
    VALUES(gen_random_uuid(),workspace,r.property_id,r.checkout,'regular',COALESCE((SELECT jsonb_agg(t.task ORDER BY t.n) FROM jsonb_array_elements(COALESCE(r.p->'regular','[]'::jsonb)) WITH ORDINALITY t(task,n) WHERE NOT COALESCE(r.p->'notApplicable'->'regular','[]'::jsonb) @> jsonb_build_array(t.n-1)),'[]'::jsonb),r.cleaner_user_id,r.assignment_id,r.reservation_key,r.arrival,r.checkout_time);
   END IF;
  ELSE
   started:=jsonb_array_length(j.checked)>0 OR EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE job_id=j.id) OR EXISTS(SELECT 1 FROM turnli_job_issues WHERE job_id=j.id);
   IF (j.state='scheduled' AND NOT started) OR (j.state='cancelled' AND j.auto_cancelled) THEN
    UPDATE turnli_cleaning_jobs SET scheduled_date=r.checkout,reservation_arrival=r.arrival,planned_after=r.checkout_time,cleaner_user_id=r.cleaner_user_id,property_assignment_id=r.assignment_id,state='scheduled',auto_cancelled=false,turnover_attention=false,revision=revision+1,updated_at=now()
    WHERE id=j.id AND ROW(scheduled_date,reservation_arrival,planned_after,cleaner_user_id,property_assignment_id,state,turnover_attention) IS DISTINCT FROM ROW(r.checkout,r.arrival,r.checkout_time,r.cleaner_user_id,r.assignment_id,'scheduled'::text,false);
   ELSIF j.state<>'cancelled' AND ROW(j.scheduled_date,j.reservation_arrival,j.planned_after) IS DISTINCT FROM ROW(r.checkout,r.arrival,r.checkout_time) THEN
    UPDATE turnli_cleaning_jobs SET turnover_attention=true,revision=revision+1,updated_at=now() WHERE id=j.id AND NOT turnover_attention;
   END IF;
  END IF;
 END LOOP;
 FOR j IN SELECT * FROM turnli_cleaning_jobs WHERE owner_id=workspace AND reservation_key IS NOT NULL AND NOT (property_id||':'||reservation_key=ANY(seen_keys)) AND state<>'cancelled' FOR UPDATE LOOP
  started:=jsonb_array_length(j.checked)>0 OR EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE job_id=j.id) OR EXISTS(SELECT 1 FROM turnli_job_issues WHERE job_id=j.id);
  IF j.state='scheduled' AND NOT started THEN
   UPDATE turnli_cleaning_jobs SET state='cancelled',auto_cancelled=true,revision=revision+1,updated_at=now() WHERE id=j.id;
  ELSE
   UPDATE turnli_cleaning_jobs SET turnover_attention=true,revision=revision+1,updated_at=now() WHERE id=j.id AND NOT turnover_attention;
  END IF;
 END LOOP;
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION turnli_reconcile_calendar_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM turnli_reconcile_turnovers(OLD.owner_id); RETURN OLD; END IF;
 PERFORM turnli_reconcile_turnovers(NEW.owner_id); RETURN NEW;
END $$;
-- statement-breakpoint
DROP TRIGGER IF EXISTS turnli_calendar_turnovers ON turnli_calendars;
CREATE TRIGGER turnli_calendar_turnovers AFTER INSERT OR DELETE OR UPDATE OF bookings,property_id,enabled,check_out ON turnli_calendars FOR EACH ROW EXECUTE FUNCTION turnli_reconcile_calendar_trigger();
DROP TRIGGER IF EXISTS turnli_assignment_turnovers ON turnli_property_assignments;
CREATE TRIGGER turnli_assignment_turnovers AFTER UPDATE OF state ON turnli_property_assignments FOR EACH ROW EXECUTE FUNCTION turnli_reconcile_calendar_trigger();
-- statement-breakpoint
SELECT turnli_reconcile_turnovers(owner_id) FROM (SELECT DISTINCT owner_id FROM turnli_property_assignments WHERE state='active') workspaces;
