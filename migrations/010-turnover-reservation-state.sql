-- Assignment revocation must not masquerade as a reservation cancellation.
-- No data backfill: existing cancellations are reconsidered only by normal reconciliation.
ALTER TABLE turnli_calendars ADD COLUMN IF NOT EXISTS pending_removals jsonb NOT NULL DEFAULT '[]';
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
   a.id AS assignment_id,a.cleaner_user_id,p,NOT c.pending_removals @> jsonb_build_array(b->>'id') AS confirmed_present
  FROM turnli_calendars c JOIN turnli_dashboard d ON d.owner_id=c.owner_id
  CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
  CROSS JOIN LATERAL jsonb_array_elements(c.bookings) b
  LEFT JOIN turnli_property_assignments a ON a.owner_id=c.owner_id AND a.property_id=c.property_id AND a.state='active'
  WHERE c.owner_id=workspace AND p->>'id'=c.property_id AND b->>'id' IS NOT NULL
  ORDER BY c.property_id,b->>'id',c.last_success DESC NULLS LAST,c.id
 LOOP
  seen_keys:=array_append(seen_keys,r.property_id||':'||r.reservation_key);
  SELECT * INTO j FROM turnli_cleaning_jobs WHERE owner_id=workspace AND property_id=r.property_id AND reservation_key=r.reservation_key FOR UPDATE;
  IF NOT FOUND THEN
   -- Do not backfill historical stays or infer completed work from checkout.
   IF r.assignment_id IS NOT NULL AND r.confirmed_present AND r.checkout >= (now() AT TIME ZONE 'Europe/London')::date THEN
    INSERT INTO turnli_cleaning_jobs(id,owner_id,property_id,scheduled_date,kind,tasks,cleaner_user_id,property_assignment_id,reservation_key,reservation_arrival,planned_after)
    VALUES(gen_random_uuid(),workspace,r.property_id,r.checkout,'regular',COALESCE((SELECT jsonb_agg(t.task ORDER BY t.n) FROM jsonb_array_elements(COALESCE(r.p->'regular','[]'::jsonb)) WITH ORDINALITY t(task,n) WHERE NOT COALESCE(r.p->'notApplicable'->'regular','[]'::jsonb) @> jsonb_build_array(t.n-1)),'[]'::jsonb),r.cleaner_user_id,r.assignment_id,r.reservation_key,r.arrival,r.checkout_time);
   END IF;
  ELSE
   started:=jsonb_array_length(j.checked)>0 OR EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE job_id=j.id) OR EXISTS(SELECT 1 FROM turnli_job_issues WHERE job_id=j.id);
   IF (j.state='scheduled' AND NOT started) OR (j.state='cancelled' AND j.auto_cancelled AND r.confirmed_present) THEN
    UPDATE turnli_cleaning_jobs SET scheduled_date=r.checkout,reservation_arrival=r.arrival,planned_after=r.checkout_time,cleaner_user_id=COALESCE(r.cleaner_user_id,j.cleaner_user_id),property_assignment_id=COALESCE(r.assignment_id,j.property_assignment_id),state='scheduled',auto_cancelled=false,turnover_attention=false,revision=revision+1,updated_at=now()
    WHERE id=j.id AND ROW(scheduled_date,reservation_arrival,planned_after,cleaner_user_id,property_assignment_id,state,turnover_attention) IS DISTINCT FROM ROW(r.checkout,r.arrival,r.checkout_time,COALESCE(r.cleaner_user_id,j.cleaner_user_id),COALESCE(r.assignment_id,j.property_assignment_id),'scheduled'::text,false);
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
