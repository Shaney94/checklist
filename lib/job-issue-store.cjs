const {database}=require('./calendar-store.cjs');
function createStore(db=database()){
 return {
 async job(user,id,host){return (await db`SELECT j.id,j.revision,j.state FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.id=${id} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))) AND ((${host} AND j.owner_id=${user.workspaceId}) OR (NOT ${host} AND j.cleaner_user_id=${user.id} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state IN ('scheduled','awaiting_review','approved','issue_reported')))`)[0];},
 async list(user,id,host){return db`SELECT i.id,i.category,i.description,i.created_at AS "createdAt",(i.photo_bytes IS NOT NULL) AS "hasPhoto" FROM turnli_job_issues i JOIN turnli_cleaning_jobs j ON j.id=i.job_id JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.id=${id} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))) AND ((${host} AND j.owner_id=${user.workspaceId}) OR (NOT ${host} AND j.cleaner_user_id=${user.id} AND i.reported_by=${user.id} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state IN ('scheduled','awaiting_review','approved','issue_reported'))) ORDER BY i.created_at,i.id`;},
 async photo(user,id,issueId,host){return (await db`SELECT encode(i.photo_bytes,'base64') AS data FROM turnli_job_issues i JOIN turnli_cleaning_jobs j ON j.id=i.job_id JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.id=${id} AND i.id=${issueId} AND i.photo_bytes IS NOT NULL AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))) AND ((${host} AND j.owner_id=${user.workspaceId}) OR (NOT ${host} AND j.cleaner_user_id=${user.id} AND i.reported_by=${user.id} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND j.state IN ('scheduled','awaiting_review','approved','issue_reported')))`)[0];},
 async create(user,id,revision,issueId,issue,photo){
 const results=await db.transaction([
  db`SELECT id FROM turnli_cleaning_jobs WHERE id=${id} AND cleaner_user_id=${user} FOR UPDATE`,
  db`WITH added AS (INSERT INTO turnli_job_issues(id,job_id,reported_by,category,description,photo_bytes,photo_width,photo_height)
   SELECT ${issueId},j.id,${user},${issue.category},${issue.description},decode(${photo?photo.bytes.toString('base64'):null},'base64'),${photo?.width||null},${photo?.height||null}
   FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.id=${id} AND j.cleaner_user_id=${user} AND j.state='scheduled' AND j.revision=${revision} AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))) AND (SELECT count(*) FROM turnli_job_issues WHERE job_id=j.id)<20 ON CONFLICT(id) DO NOTHING RETURNING id),
   changed AS (UPDATE turnli_cleaning_jobs SET revision=revision+1,updated_at=now() WHERE id=${id} AND EXISTS(SELECT 1 FROM added) RETURNING *),
   event AS (INSERT INTO turnli_job_events(owner_id,property_id,job_id,kind,revision,scheduled_date,state) SELECT owner_id,property_id,id,'issue.reported',revision,scheduled_date,state FROM changed)
   SELECT id FROM added`
 ]);return results[1][0];
 }
 };
}
module.exports={createStore};
