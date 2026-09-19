const {randomUUID}=require('node:crypto');
const {database}=require('./calendar-store.cjs');
const {MIN_PHOTOS,MAX_PHOTOS}=require('./completion.cjs');
function createStore(db=database()){
 // A row lock shared with checklist, assignment and cancellation writes serializes
 // photo changes and submission. Every statement also verifies identity and scope.
 const lock=(user,id,revision)=>db`SELECT j.id FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.id=${id} AND j.cleaner_user_id=${user} AND j.state='scheduled' AND j.revision=${revision} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))) FOR UPDATE OF j`;
 return {
 async view(user,id,host){return (await db`SELECT j.id,j.property_id AS "propertyId",p->>'name' AS "propertyName",j.kind,j.state,j.tasks,j.checked,j.revision,j.submitted_at AS "submittedAt",j.reviewed_at AS "reviewedAt",j.review_note AS "reviewNote",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'width',f.width,'height',f.height,'size',f.byte_size) ORDER BY f.created_at,f.id) FROM turnli_cleaning_job_photos f WHERE f.job_id=j.id AND f.uploaded_by=j.cleaner_user_id),'[]'::jsonb) AS photos
  FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
  WHERE j.id=${id} AND p->>'id'=j.property_id AND ((${host} AND j.owner_id=${user.workspaceId} AND j.state IN ('awaiting_review','approved','issue_reported')) OR (NOT ${host} AND j.cleaner_user_id=${user.id} AND j.state IN ('scheduled','awaiting_review','approved','issue_reported')))`)[0];},
 async add(user,id,revision,photo){
  const photoId=randomUUID();
  const results=await db.transaction([
   lock(user,id,revision),
   db`INSERT INTO turnli_cleaning_job_photos(id,job_id,uploaded_by,content_type,byte_size,width,height,sha256,bytes)
    SELECT ${photoId},j.id,${user},'image/jpeg',${photo.size},${photo.width},${photo.height},${photo.sha256},decode(${photo.bytes.toString('base64')},'base64')
    FROM turnli_cleaning_jobs j JOIN turnli_dashboard d ON d.owner_id=j.owner_id WHERE j.id=${id} AND j.cleaner_user_id=${user} AND j.state='scheduled' AND j.revision=${revision}
    AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))
    AND (SELECT count(*) FROM turnli_cleaning_job_photos WHERE job_id=j.id)<${MAX_PHOTOS}
    ON CONFLICT(job_id,sha256) DO NOTHING RETURNING id`,
   db`UPDATE turnli_cleaning_jobs SET revision=revision+1,updated_at=now() WHERE id=${id} AND cleaner_user_id=${user} AND state='scheduled' AND revision=${revision} AND EXISTS(SELECT 1 FROM turnli_cleaning_job_photos WHERE id=${photoId} AND job_id=${id}) RETURNING revision`
  ]);return results[2][0];
 },
 async remove(user,id,revision,photoId){
  const results=await db.transaction([
   lock(user,id,revision),
   db`WITH removed AS (DELETE FROM turnli_cleaning_job_photos f USING turnli_cleaning_jobs j,turnli_dashboard d WHERE f.id=${photoId} AND f.job_id=j.id AND j.id=${id} AND f.uploaded_by=${user} AND j.cleaner_user_id=${user} AND j.state='scheduled' AND j.revision=${revision} AND d.owner_id=j.owner_id AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))) RETURNING f.id)
    UPDATE turnli_cleaning_jobs SET revision=revision+1,updated_at=now() WHERE id=${id} AND EXISTS(SELECT 1 FROM removed) RETURNING revision`
  ]);return results[1][0];
 },
 async submit(user,id,revision){
  const results=await db.transaction([
   lock(user,id,revision),
   db`UPDATE turnli_cleaning_jobs j SET state='awaiting_review',submitted_at=now(),submitted_by=${user},revision=revision+1,updated_at=now()
    WHERE j.id=${id} AND j.cleaner_user_id=${user} AND j.state='scheduled' AND j.revision=${revision}
    AND EXISTS(SELECT 1 FROM turnli_dashboard d WHERE d.owner_id=j.owner_id AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id))))
    AND jsonb_array_length(j.tasks)>0 AND jsonb_array_length(j.checked)=jsonb_array_length(j.tasks)
    AND NOT EXISTS(SELECT 1 FROM generate_series(0,jsonb_array_length(j.tasks)-1) i WHERE NOT j.checked @> jsonb_build_array(i))
    AND (SELECT count(*) FROM turnli_cleaning_job_photos f WHERE f.job_id=j.id AND f.uploaded_by=${user}) BETWEEN ${MIN_PHOTOS} AND ${MAX_PHOTOS}
    RETURNING revision,state`
  ]);return results[1][0];
 },
 async review(user,id,revision,decision,note){return (await db`UPDATE turnli_cleaning_jobs j SET state=${decision},reviewed_at=now(),reviewed_by=${user.id},review_note=${note},revision=revision+1,updated_at=now()
  WHERE j.id=${id} AND j.owner_id=${user.workspaceId} AND j.state='awaiting_review' AND j.revision=${revision}
  AND EXISTS(SELECT 1 FROM turnli_dashboard d WHERE d.owner_id=j.owner_id AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))) RETURNING revision,state`)[0];},
 async photo(user,id,photoId,host){return (await db`SELECT encode(f.bytes,'base64') AS data FROM turnli_cleaning_job_photos f JOIN turnli_cleaning_jobs j ON j.id=f.job_id JOIN turnli_dashboard d ON d.owner_id=j.owner_id
  WHERE f.id=${photoId} AND j.id=${id} AND d.data @> jsonb_build_object('properties',jsonb_build_array(jsonb_build_object('id',j.property_id)))
  AND ((${host} AND j.owner_id=${user.workspaceId} AND j.state IN ('awaiting_review','approved','issue_reported')) OR (NOT ${host} AND j.cleaner_user_id=${user.id} AND f.uploaded_by=${user.id} AND j.state IN ('scheduled','awaiting_review','approved','issue_reported')))`)[0];}
 };
}
module.exports={createStore};
