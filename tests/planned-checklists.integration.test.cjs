const {enabled}=require('./fixtures/integration-db.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),sharp=require('sharp');
const {database}=require('../lib/calendar-store.cjs'),{createStore:jobs}=require('../lib/cleaning-job-store.cjs'),{createStore:workspaces}=require('../lib/dashboard-store.cjs'),{createStore:assignments}=require('../lib/property-assignment-store.cjs'),{createStore:completion}=require('../lib/completion-store.cjs'),{createStore:issues}=require('../lib/job-issue-store.cjs');
const {validatePhoto}=require('../lib/completion.cjs'),{change}=require('../src/server/handlers/dashboard.js'),{templates}=require('../lib/checklist-templates.cjs');
test('PostgreSQL: only untouched planned snapshots refresh; applicability, history, isolation and idempotence are preserved',{skip:!enabled},async()=>{
 const db=database(),owner='test-checklists:'+randomUUID(),other='test-other:'+randomUUID(),property=randomUUID(),cleaner={id:'test-cleaner:'+randomUUID(),email:randomUUID()+'@example.test'},host={id:'host',workspaceId:owner},j=jobs(db),w=workspaces(db),a=assignments(db),c=completion(db),i=issues(db);
 const snapshot=id=>db`SELECT to_jsonb(j) AS job,(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM turnli_cleaning_job_photos f WHERE f.job_id=j.id) AS evidence FROM turnli_cleaning_jobs j WHERE j.id=${id}`;
 try{
  await w.save(owner,0,{properties:[{id:property,name:'Synthetic',regular:templates.regular.slice(0,12),deep:['Deep task'],notApplicable:{regular:[7],deep:[]},checked:{regular:[],deep:[]}}]});
  const invite=await a.invite(host,property,cleaner.email);assert(await a.accept(cleaner,invite.id));
  const make=async()=> (await j.create(owner,property,'2099-06-24','regular')).id;
  const untouched=await make(),progressed=await make(),cleared=await make(),photoOnly=await make(),removedPhoto=await make(),reported=await make(),submitted=await make(),approved=await make(),cancelled=await make(),unknown=await make();
  // Existing automatic jobs use this same table and snapshot path.
  await db`UPDATE turnli_cleaning_jobs SET reservation_key='synthetic-turnover' WHERE id=${untouched}`;
  await j.check(cleaner.id,progressed,0,0,true);await j.check(cleaner.id,cleared,0,0,true);await j.check(cleaner.id,cleared,1,0,false);
  const photo=await validatePhoto({type:'image/png',data:(await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer()).toString('base64')});
  await c.add(cleaner.id,photoOnly,0,photo);await c.add(cleaner.id,removedPhoto,0,photo);const evidence=await c.view(cleaner,removedPhoto,false);await c.remove(cleaner.id,removedPhoto,1,evidence.photos[0].id);
  assert.equal((await snapshot(removedPhoto))[0].job.checklist_protected,true);assert.equal((await snapshot(cleared))[0].job.checklist_protected,true);
  await i.create(cleaner.id,reported,0,randomUUID(),{category:'maintenance',description:'Synthetic issue'},null);
  // Terminal fixtures prove even empty/legacy terminal records cannot be rewritten.
  await db`UPDATE turnli_cleaning_jobs SET state='awaiting_review',submitted_at=now(),submitted_by=${cleaner.id} WHERE id=${submitted}`;
  await db`UPDATE turnli_cleaning_jobs SET state='approved',submitted_at=now(),submitted_by=${cleaner.id},reviewed_at=now(),reviewed_by=${host.id} WHERE id=${approved}`;
  await j.cancel(owner,cancelled,0);await db`UPDATE turnli_cleaning_jobs SET revision=revision+2 WHERE id=${unknown}`;
  // Exercise the actual migration's legacy audit, restricted to this synthetic workspace.
  const migration=require('node:fs').readFileSync('migrations/011-planned-job-checklists.sql','utf8').split('-- statement-breakpoint')[0];
  const audit=migration.slice(migration.indexOf('UPDATE turnli_cleaning_jobs j SET')).replace('WHERE NOT checklist_protected', 'WHERE j.owner_id=$1 AND NOT checklist_protected');
  await db.query(audit,[owner]);assert.equal((await snapshot(unknown))[0].job.checklist_protected,true);assert.equal((await snapshot(untouched))[0].job.checklist_protected,false);
  const protectedIds=[progressed,cleared,photoOnly,removedPhoto,reported,submitted,approved,cancelled,unknown],before=await Promise.all(protectedIds.map(snapshot)),old=(await snapshot(untouched))[0].job;
  assert.equal((await db`SELECT turnli_reconcile_job_checklists(${other},${property}) AS n`)[0].n,0);
  let saved=await w.load(owner);saved=await w.save(owner,saved.revision,change(saved.data,{action:'template',id:property,kind:'regular'}));
  const updated=(await snapshot(untouched))[0].job;assert.deepEqual(updated.tasks,templates.regular.filter((_,n)=>n!==7));assert.equal(updated.revision,old.revision+1);
  for(const field of ['id','owner_id','property_id','state','scheduled_date','cleaner_user_id','property_assignment_id','reservation_key','checked'])assert.deepEqual(updated[field],old[field]);
  assert.deepEqual(await Promise.all(protectedIds.map(snapshot)),before);
  assert.equal((await db`SELECT turnli_reconcile_job_checklists(${owner},${property}) AS n`)[0].n,0);assert.deepEqual((await snapshot(untouched))[0].job,updated);
  // Stale Cleaner writes cannot address the newly reconciled task indexes.
  assert.equal(await j.check(cleaner.id,untouched,old.revision,0,true),undefined);
  const fresh=await make();assert.deepEqual((await j.assigned(cleaner.id,fresh)).tasks,updated.tasks);
  assert.equal((await db`SELECT count(*)::int AS n FROM turnli_cleaning_jobs WHERE owner_id=${owner}`)[0].n,11);
 }finally{await db`DELETE FROM turnli_cleaning_jobs WHERE owner_id=${owner}`;await db`DELETE FROM turnli_dashboard WHERE owner_id=${owner}`;await db`DELETE FROM turnli_cleaner_codes WHERE user_id=${cleaner.id}`;}
});
