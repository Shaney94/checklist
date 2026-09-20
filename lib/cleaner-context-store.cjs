const {database}=require('./calendar-store.cjs');
function createStore(db=database()){return {
 async properties(user){
  return db`SELECT p->>'id' AS id,p->>'name' AS name,CASE WHEN d.owner_id=${'user:'+user.id} THEN 'customer' ELSE 'assigned' END AS source,p->'regular' AS regular,p->'deep' AS deep,COALESCE(p->'notApplicable','{}'::jsonb) AS "notApplicable",a.id AS "assignmentId",j.id AS "jobId"
  FROM turnli_dashboard d CROSS JOIN LATERAL jsonb_array_elements(d.data->'properties') p
  LEFT JOIN turnli_property_assignments a ON a.owner_id=d.owner_id AND a.property_id=p->>'id' AND a.cleaner_user_id=${user.id} AND a.state='active'
  LEFT JOIN LATERAL (SELECT id FROM turnli_cleaning_jobs j WHERE j.owner_id=d.owner_id AND j.property_id=p->>'id' AND j.cleaner_user_id=${user.id} AND j.state='scheduled' AND turnli_job_assignment_active(j.property_assignment_id,j.owner_id,j.property_id,j.cleaner_user_id) ORDER BY scheduled_date,id LIMIT 1) j ON true
  WHERE d.owner_id=${'user:'+user.id} OR a.id IS NOT NULL OR j.id IS NOT NULL ORDER BY p->>'id'`;
 }
};}
module.exports={createStore};
