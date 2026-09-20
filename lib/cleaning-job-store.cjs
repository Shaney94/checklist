const {randomBytes,randomUUID,createHash}=require('node:crypto');
const {database,seal,unseal}=require('./calendar-store.cjs');
const hash=code=>createHash('sha256').update(code).digest('hex');
function createStore(db=database()){return {
 async code(user){return !!(await db`SELECT user_id FROM turnli_cleaner_codes WHERE user_id=${user}`)[0];},
 async currentCode(user){
  const row=(await db`SELECT encrypted_code FROM turnli_cleaner_codes WHERE user_id=${user}`)[0];
  return row?{code:row.encrypted_code?unseal(row.encrypted_code,"cleaner-code:"+user):null,legacy:!row.encrypted_code}:null;
 },
 async ensureCode(user){
  const code=randomBytes(32).toString("base64url");
  await db`INSERT INTO turnli_cleaner_codes(user_id,code_hash,encrypted_code) VALUES(${user},${hash(code)},${seal(code,"cleaner-code:"+user)}) ON CONFLICT(user_id) DO NOTHING`;
  return this.currentCode(user);
 },
 async rotateCode(user){
  const code=randomBytes(32).toString('base64url');
  await db`INSERT INTO turnli_cleaner_codes(user_id,code_hash,encrypted_code) VALUES(${user},${hash(code)},${seal(code,"cleaner-code:"+user)}) ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,encrypted_code=EXCLUDED.encrypted_code,updated_at=now()`;
  return code;
 },
 async cleaner(code){return (await db`SELECT user_id FROM turnli_cleaner_codes WHERE code_hash=${hash(code)}`)[0]?.user_id;},
 async list(user,host){
  // No general workspace document, contact/access fields or other Cleaners' identities in Cleaner responses.
  return db`SELECT j.id,j.property_id AS "propertyId",p->>'name' AS "propertyName",j.scheduled_date::text AS date,j.kind,j.state,j.revision,(j.reservation_key IS NOT NULL) AS automatic,j.planned_after::text AS "plannedAfter",j.turnover_attention AS "needsAttention",(j.cleaner_user_id IS NOT NULL AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id)) AS assigned,(SELECT count(*)::int FROM turnli_job_issues i WHERE i.job_id=j.id) AS "issueCount"
   FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id
   CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
   WHERE p->>'id'=j.property_id AND ((${host} AND j.owner_id=${user.workspaceId}) OR (NOT ${host} AND j.cleaner_user_id=${user.id} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state IN ('scheduled','awaiting_review','approved','issue_reported')))
   ORDER BY j.scheduled_date,j.id`;
 },
 async create(owner,propertyId,date,kind){
  const result=await db.transaction([db`SELECT owner_id FROM turnli_dashboard WHERE owner_id=${owner} FOR UPDATE`,db`INSERT INTO turnli_cleaning_jobs(id,owner_id,property_id,scheduled_date,kind,tasks,cleaner_user_id,property_assignment_id)
   SELECT ${randomUUID()},d.owner_id,${propertyId},${date}::date,${kind},COALESCE((SELECT jsonb_agg(t.task ORDER BY t.n) FROM jsonb_array_elements(COALESCE(p->${kind},'[]'::jsonb)) WITH ORDINALITY t(task,n) WHERE NOT COALESCE(p->'notApplicable'->${kind},'[]'::jsonb) @> jsonb_build_array(t.n-1)),'[]'::jsonb),a.cleaner_user_id,a.id
   FROM turnli_dashboard d CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
   LEFT JOIN turnli_property_assignments a ON a.owner_id=d.owner_id AND a.property_id=p->>'id' AND a.state='active' WHERE d.owner_id=${owner} AND p->>'id'=${propertyId} RETURNING id`]);return result[1][0];
 },
 async hostJob(owner,id){return (await db`SELECT j.id,j.state,j.revision,(j.reservation_key IS NOT NULL) AS automatic FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.owner_id=${owner} AND j.id=${id} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))`)[0];},
 async assign(owner,id,revision,cleaner,code){
  // Recheck the code at the write boundary: rotation during validation fails closed.
  return (await db`WITH changed AS (UPDATE turnli_cleaning_jobs j SET cleaner_user_id=${cleaner},property_assignment_id=NULL,revision=revision+1,updated_at=now()
   WHERE j.owner_id=${owner} AND j.id=${id} AND j.revision=${revision} AND j.state='scheduled'
   AND (${cleaner}::text IS NULL OR EXISTS(SELECT 1 FROM turnli_cleaner_codes c WHERE c.user_id=${cleaner} AND c.code_hash=${code?hash(code):null}))
   AND EXISTS(SELECT 1 FROM turnli_dashboard d WHERE d.owner_id=j.owner_id AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))) RETURNING id), removed AS (DELETE FROM turnli_cleaning_job_photos f USING changed WHERE f.job_id=changed.id AND f.uploaded_by IS DISTINCT FROM ${cleaner} RETURNING f.id) SELECT id FROM changed`)[0];
 },
 async cancel(owner,id,revision){return (await db`WITH changed AS (UPDATE turnli_cleaning_jobs SET state='cancelled',cleaner_user_id=NULL,revision=revision+1,updated_at=now() WHERE owner_id=${owner} AND id=${id} AND revision=${revision} AND state='scheduled' RETURNING id), removed AS (DELETE FROM turnli_cleaning_job_photos f USING changed WHERE f.job_id=changed.id RETURNING f.id) SELECT id FROM changed`)[0];},
 async assigned(user,id){return (await db`SELECT j.id,j.property_id AS "propertyId",p->>'name' AS "propertyName",j.scheduled_date::text AS date,j.kind,j.state,(j.reservation_key IS NOT NULL) AS automatic,j.planned_after::text AS "plannedAfter",j.turnover_attention AS "needsAttention",j.tasks,j.checked,j.revision,COALESCE(p->'faqs','[]'::jsonb) AS faqs
  FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
  WHERE j.id=${id} AND j.cleaner_user_id=${user} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state IN ('scheduled','awaiting_review','approved','issue_reported') AND p->>'id'=j.property_id`)[0];},
 async guide(user,id){
  // Assignment and property ownership are checked in the same statement that reads sensitive content.
  return (await db`SELECT COALESCE(g.revision,0) AS revision,COALESCE(g.guide,'{}'::jsonb) AS guide
   FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id
   LEFT JOIN turnli_property_guides g ON g.owner_id=j.owner_id AND g.property_id=j.property_id
   WHERE j.id=${id} AND j.cleaner_user_id=${user} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state='scheduled'
   AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))`)[0];
 },
 async check(user,id,revision,index,checked){return (await db`UPDATE turnli_cleaning_jobs j SET checked=CASE WHEN ${checked} THEN (SELECT COALESCE(jsonb_agg(DISTINCT n),'[]'::jsonb) FROM jsonb_array_elements(j.checked || jsonb_build_array(${index}::integer)) n) ELSE (SELECT COALESCE(jsonb_agg(n),'[]'::jsonb) FROM jsonb_array_elements(j.checked) n WHERE n<>to_jsonb(${index}::integer)) END,revision=revision+1,updated_at=now()
   WHERE j.id=${id} AND j.cleaner_user_id=${user} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state='scheduled' AND j.revision=${revision} AND ${index}>=0 AND ${index}<jsonb_array_length(j.tasks)
   AND EXISTS(SELECT 1 FROM turnli_dashboard d WHERE d.owner_id=j.owner_id AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))) RETURNING id`)[0];}
};}
module.exports={createStore};
