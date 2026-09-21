const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {database,seal}=require('./calendar-store.cjs');
function createStore(db=database()){
 const lock=owner=>db`SELECT owner_id FROM turnli_dashboard WHERE owner_id=${owner} FOR UPDATE`;
 return {
 async host(owner,property){return db`SELECT a.id,a.invited_email AS email,a.state,a.delivery,a.expires_at AS "expiresAt" FROM turnli_property_assignments a JOIN turnli_dashboard d ON d.owner_id=a.owner_id WHERE a.owner_id=${owner} AND a.property_id=${property} AND a.state IN ('pending','active') AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',a.property_id))) ORDER BY a.created_at DESC`;},
 async invite(user,property,address){
  const id=randomUUID();const result=await db.transaction([lock(user.workspaceId),
   db`UPDATE turnli_property_assignments SET state='revoked',revoked_at=now() WHERE owner_id=${user.workspaceId} AND property_id=${property} AND state='pending' AND expires_at<=now()`,
   db`INSERT INTO turnli_property_assignments(id,owner_id,property_id,invited_email,created_by) SELECT ${id},d.owner_id,${property},${address},${user.id} FROM turnli_dashboard d WHERE d.owner_id=${user.workspaceId} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',${property}::text))) AND NOT EXISTS(SELECT 1 FROM turnli_property_assignments WHERE owner_id=d.owner_id AND created_at>now()-interval '1 hour' GROUP BY owner_id HAVING count(*)>=20) ON CONFLICT DO NOTHING RETURNING id`
  ]);return result[2][0];
 },
 async delivered(owner,id,ok){await db`UPDATE turnli_property_assignments SET delivery=${ok?'sent':'failed'} WHERE owner_id=${owner} AND id=${id} AND state='pending'`;},
 async inbox(user){return db`SELECT a.id,a.property_id AS "propertyId",p->>'name' AS "propertyName",a.state,a.expires_at AS "expiresAt" FROM turnli_property_assignments a JOIN turnli_dashboard d ON d.owner_id=a.owner_id CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p WHERE p->>'id'=a.property_id AND ((a.state='pending' AND a.invited_email=${user.email.toLowerCase()} AND a.expires_at>now()) OR (a.state='active' AND a.cleaner_user_id=${user.id})) ORDER BY a.created_at`;},
 async onboarding(user){return db`SELECT a.id,p->>'name' AS "propertyName" FROM turnli_property_assignments a JOIN turnli_dashboard d ON d.owner_id=a.owner_id CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p WHERE p->>'id'=a.property_id AND a.state='pending' AND a.expires_at>now() AND a.invited_email=${user.email.toLowerCase()} ORDER BY a.created_at`;},
 async pending(user,id){return (await db`SELECT a.id FROM turnli_property_assignments a JOIN turnli_dashboard d ON d.owner_id=a.owner_id WHERE a.id=${id} AND a.invited_email=${user.email.toLowerCase()} AND a.state='pending' AND a.expires_at>now() AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',a.property_id)))`)[0];},
 async accept(user,id){
  const code=randomBytes(32).toString('base64url');
  // Lock the canonical workspace before accepting, creating jobs or revoking.
  const result=await db.transaction([
   db`SELECT d.owner_id FROM turnli_dashboard d JOIN turnli_property_assignments a ON a.owner_id=d.owner_id WHERE a.id=${id} AND a.invited_email=${user.email.toLowerCase()} FOR UPDATE OF d`,
   db`INSERT INTO turnli_cleaner_codes(user_id,code_hash,encrypted_code) VALUES(${user.id},${createHash('sha256').update(code).digest('hex')},${seal(code,'cleaner-code:'+user.id)}) ON CONFLICT(user_id) DO NOTHING`,
   db`WITH accepted AS (UPDATE turnli_property_assignments a SET state='active',cleaner_user_id=${user.id},accepted_at=now() WHERE id=${id} AND invited_email=${user.email.toLowerCase()} AND state='pending' AND expires_at>now() AND EXISTS(SELECT 1 FROM turnli_dashboard d WHERE d.owner_id=a.owner_id AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',a.property_id)))) RETURNING id,owner_id,property_id), assigned AS (UPDATE turnli_cleaning_jobs j SET cleaner_user_id=${user.id},property_assignment_id=a.id,revision=j.revision+1,updated_at=now() FROM accepted a WHERE j.owner_id=a.owner_id AND j.property_id=a.property_id AND ((j.state='scheduled' AND (j.cleaner_user_id IS NULL OR EXISTS(SELECT 1 FROM turnli_property_assignments old WHERE old.id=j.property_assignment_id AND old.state='revoked'))) OR (j.cleaner_user_id=${user.id} AND j.property_assignment_id IS NULL)) RETURNING j.id) SELECT id FROM accepted`
  ]);return result[2][0];
 },
 async decline(user,id){return (await db`UPDATE turnli_property_assignments SET state='declined' WHERE id=${id} AND invited_email=${user.email.toLowerCase()} AND state='pending' RETURNING id`)[0];},
 async revoke(owner,id){
  const result=await db.transaction([lock(owner),
   // Bind jobs only when this request actually revokes a current relationship.
   // Replaying an old revoke must not affect a later accepted invitation.
   db`WITH revoked AS (UPDATE turnli_property_assignments SET state='revoked',revoked_at=now() WHERE owner_id=${owner} AND id=${id} AND state IN ('pending','active') RETURNING id,owner_id,property_id,cleaner_user_id),
    changed AS (UPDATE turnli_cleaning_jobs j SET property_assignment_id=a.id,revision=j.revision+1,updated_at=now() FROM revoked a WHERE j.owner_id=a.owner_id AND j.property_id=a.property_id AND j.cleaner_user_id=a.cleaner_user_id RETURNING j.id,j.state),
    removed AS (DELETE FROM turnli_cleaning_job_photos f USING changed j WHERE f.job_id=j.id AND j.state='scheduled' RETURNING f.id) SELECT id FROM revoked`
  ]);return result[1][0];
 },
 async guide(user,id){return (await db`SELECT COALESCE(g.revision,0) AS revision,COALESCE(g.guide,'{}'::jsonb) AS guide FROM turnli_property_assignments a JOIN turnli_dashboard d ON d.owner_id=a.owner_id LEFT JOIN turnli_property_guides g ON g.owner_id=a.owner_id AND g.property_id=a.property_id WHERE a.id=${id} AND a.state='active' AND a.cleaner_user_id=${user} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',a.property_id)))`)[0];},
 async calendars(user,id){return db`SELECT a.id AS "assignmentId",a.property_id AS "propertyId",p->>'name' AS "propertyName",c.id,c.bookings,c.check_in,c.check_out,c.feed_host,c.sync_error FROM turnli_property_assignments a JOIN turnli_dashboard d ON d.owner_id=a.owner_id CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p LEFT JOIN turnli_calendars c ON c.owner_id=a.owner_id AND c.property_id=a.property_id AND c.enabled WHERE (${id}='all' OR a.id::text=${id}) AND a.cleaner_user_id=${user} AND a.state='active' AND p->>'id'=a.property_id`;}
 };
}
module.exports={createStore};
