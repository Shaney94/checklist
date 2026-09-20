-- Sticky protection survives unchecked tasks and removed draft photos.
ALTER TABLE turnli_cleaning_jobs ADD COLUMN IF NOT EXISTS checklist_protected boolean NOT NULL DEFAULT false;
-- Existing revision gaps are not proof of untouched work. The one known gap is
-- the extra revision in the atomic property-revocation CTE, identified by its
-- cancellation event and the same transaction's recorded revocation timestamp.
UPDATE turnli_cleaning_jobs j SET checklist_protected=true WHERE NOT checklist_protected AND (
 j.checked<>'[]'::jsonb OR j.state IN ('awaiting_review','approved','issue_reported') OR
 j.submitted_at IS NOT NULL OR j.submitted_by IS NOT NULL OR j.reviewed_at IS NOT NULL OR j.reviewed_by IS NOT NULL OR j.review_note IS NOT NULL OR j.turnover_attention OR
 EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE job_id=j.id) OR EXISTS(SELECT 1 FROM turnli_job_issues WHERE job_id=j.id) OR
 EXISTS(SELECT 1 FROM turnli_job_events WHERE job_id=j.id AND kind NOT IN ('job.created','job.changed','job.cancelled','job.checklist_refreshed')) OR
 EXISTS(SELECT 1 FROM generate_series(1,j.revision) v WHERE
  NOT EXISTS(SELECT 1 FROM turnli_job_events e WHERE e.job_id=j.id AND e.revision=v AND e.kind IN ('job.changed','job.cancelled','job.checklist_refreshed')) AND
  NOT EXISTS(SELECT 1 FROM turnli_job_events e JOIN turnli_property_assignments a ON a.owner_id=e.owner_id AND a.property_id=e.property_id AND a.revoked_at=e.occurred_at WHERE e.job_id=j.id AND e.kind='job.cancelled' AND e.revision=v+1))
);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION turnli_protect_job_checklist() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.checklist_protected:=OLD.checklist_protected OR NEW.checklist_protected OR OLD.checked<>'[]'::jsonb OR NEW.checked IS DISTINCT FROM OLD.checked OR
 OLD.state IN ('awaiting_review','approved','issue_reported') OR NEW.state IN ('awaiting_review','approved','issue_reported') OR
 NEW.submitted_at IS NOT NULL OR NEW.submitted_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.review_note IS NOT NULL OR
 EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE job_id=NEW.id) OR EXISTS(SELECT 1 FROM turnli_job_issues WHERE job_id=NEW.id);
 RETURN NEW;
END $$;
-- statement-breakpoint
DROP TRIGGER IF EXISTS turnli_protect_job_checklist ON turnli_cleaning_jobs;
CREATE TRIGGER turnli_protect_job_checklist BEFORE UPDATE ON turnli_cleaning_jobs FOR EACH ROW EXECUTE FUNCTION turnli_protect_job_checklist();
-- statement-breakpoint
CREATE OR REPLACE FUNCTION turnli_reconcile_job_checklists(workspace text,property text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE p jsonb; j turnli_cleaning_jobs%ROWTYPE; current_tasks jsonb; changed integer:=0;
BEGIN
 -- Same workspace-then-job lock order as property setup, assignment and creation.
 PERFORM 1 FROM turnli_dashboard WHERE owner_id=workspace FOR UPDATE;
 SELECT item INTO p FROM turnli_dashboard d CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') item WHERE d.owner_id=workspace AND item->>'id'=property;
 IF p IS NULL THEN RETURN 0; END IF;
 FOR j IN SELECT * FROM turnli_cleaning_jobs WHERE owner_id=workspace AND property_id=property AND state='scheduled' ORDER BY id FOR UPDATE LOOP
  IF j.checklist_protected OR j.checked<>'[]'::jsonb OR j.turnover_attention OR j.submitted_at IS NOT NULL OR j.submitted_by IS NOT NULL OR j.reviewed_at IS NOT NULL OR j.reviewed_by IS NOT NULL OR j.review_note IS NOT NULL OR
    EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE job_id=j.id) OR EXISTS(SELECT 1 FROM turnli_job_issues WHERE job_id=j.id) THEN CONTINUE; END IF;
  SELECT COALESCE(jsonb_agg(t.task ORDER BY t.n),'[]'::jsonb) INTO current_tasks FROM jsonb_array_elements(COALESCE(p->j.kind,'[]'::jsonb)) WITH ORDINALITY t(task,n) WHERE NOT COALESCE(p->'notApplicable'->j.kind,'[]'::jsonb) @> jsonb_build_array(t.n-1);
  IF j.tasks IS DISTINCT FROM current_tasks THEN
   UPDATE turnli_cleaning_jobs SET tasks=current_tasks,revision=revision+1,updated_at=now() WHERE id=j.id;
   INSERT INTO turnli_job_events(owner_id,property_id,job_id,kind,revision,scheduled_date,state) VALUES(workspace,property,j.id,'job.checklist_refreshed',j.revision+1,j.scheduled_date,j.state);
   changed:=changed+1;
  END IF;
 END LOOP;
 RETURN changed;
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION turnli_property_checklists_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p jsonb;
BEGIN
 FOR p IN SELECT value FROM jsonb_array_elements(NEW.data->'properties') LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.data->'properties') prior_property WHERE prior_property->>'id'=p->>'id' AND ROW(prior_property->'regular',prior_property->'deep',prior_property->'notApplicable') IS DISTINCT FROM ROW(p->'regular',p->'deep',p->'notApplicable')) THEN
   PERFORM turnli_reconcile_job_checklists(NEW.owner_id,p->>'id');
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
-- statement-breakpoint
DROP TRIGGER IF EXISTS turnli_property_checklists_changed ON turnli_dashboard;
CREATE TRIGGER turnli_property_checklists_changed AFTER UPDATE OF data ON turnli_dashboard FOR EACH ROW EXECUTE FUNCTION turnli_property_checklists_changed();
