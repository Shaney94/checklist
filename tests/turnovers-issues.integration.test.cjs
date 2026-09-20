// Opt-in Neon verification. Synthetic records only; cleanup in finally.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),sharp=require('sharp');
const {database}=require('../lib/calendar-store.cjs'),{createStore:assignments}=require('../lib/property-assignment-store.cjs'),{createStore:jobs}=require('../lib/cleaning-job-store.cjs'),{createStore:issues}=require('../lib/job-issue-store.cjs'),{createStore:completion}=require('../lib/completion-store.cjs');
const {validatePhoto}=require('../lib/completion.cjs');
test('Neon: idempotent turnovers, snapshots, cancellation/history, issues and assignment isolation',{skip:process.env.TURNLI_TEST_DATABASE!=='1'},async()=>{
 const db=database(),suffix=randomUUID(),owner='test-turnover:'+suffix,other='test-other:'+suffix,property=randomUUID(),foreign=randomUUID(),calendar=randomUUID();
 const host={id:'host',workspaceId:owner},cleaner={id:'test-cleaner:'+suffix,email:suffix+'@example.test'},outsider={id:'test-outsider:'+suffix,email:'other-'+suffix+'@example.test'};
 const a=assignments(db),j=jobs(db),i=issues(db),c=completion(db);
 const booking=(id,day='2099-03-24')=>({id,arrival:{date:'2099-03-20',time:'15:00',allDay:true},checkout:{date:day,time:'10:00',allDay:true}});
 const save=bookings=>db`UPDATE turnli_calendars SET bookings=${JSON.stringify(bookings)}::jsonb,last_success=now() WHERE id=${calendar}`;
 const row=async key=>(await db`SELECT *,scheduled_date::text AS date,planned_after::text AS time FROM turnli_cleaning_jobs WHERE owner_id=${owner} AND reservation_key=${key}`)[0];
 let invitation;
 try{
  for(const [workspace,p] of [[owner,property],[other,foreign]])await db`INSERT INTO turnli_dashboard(owner_id,data) VALUES(${workspace},${JSON.stringify({properties:[{id:p,name:'Synthetic property',regular:['Applicable task','Not applicable task'],deep:['Deep task'],notApplicable:{regular:[1],deep:[]},faqs:[],checked:{regular:[],deep:[]}}]})}::jsonb)`;
  // Unassigned property, unlinked feeds and foreign Cleaner-owned calendars create no jobs.
  await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash,bookings) VALUES(${calendar},${owner},${property},'Synthetic','Custom iCal','example.test','synthetic',${randomUUID()},${JSON.stringify([booking('stay')])}::jsonb)`;
  assert.equal(await row('stay'),undefined);
  invitation=await a.invite(host,property,cleaner.email);assert(await a.accept(cleaner,invitation.id));
  let job=await row('stay');assert(job);assert.equal(job.property_assignment_id,invitation.id);assert.equal(job.cleaner_user_id,cleaner.id);assert.deepEqual(job.tasks,['Applicable task']);assert.equal(job.time,'10:00:00');
  const initialId=job.id,initialRevision=job.revision;
  await Promise.all([save([booking('stay')]),save([booking('stay')])]);job=await row('stay');assert.equal(job.id,initialId);assert.equal(job.revision,initialRevision);
  assert.equal((await db`SELECT * FROM turnli_job_events WHERE job_id=${job.id}`).length,1);
  // Paused/failed syncs retain saved plans; mirrored UIDs do not duplicate work.
  await db`UPDATE turnli_calendars SET sync_error='Synthetic sync failure' WHERE id=${calendar}`;assert.equal((await row('stay')).revision,initialRevision);
  const mirror=randomUUID();await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash,bookings) VALUES(${mirror},${owner},${property},'Mirror','Custom iCal','example.test','synthetic',${randomUUID()},${JSON.stringify([booking('stay')])}::jsonb)`;
  assert.equal((await db`SELECT id FROM turnli_cleaning_jobs WHERE owner_id=${owner} AND reservation_key='stay'`).length,1);
  await db`DELETE FROM turnli_calendars WHERE id=${mirror}`;assert.equal((await row('stay')).state,'scheduled');
  for(const [workspace,p] of [[owner,null],[other,foreign]])await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash,bookings) VALUES(${randomUUID()},${workspace},${p},'Separate','Custom iCal','example.test','synthetic',${randomUUID()},${JSON.stringify([booking('unlinked-or-unassigned')])}::jsonb)`;
  assert.equal((await db`SELECT id FROM turnli_cleaning_jobs WHERE owner_id IN (${owner},${other}) AND reservation_key='unlinked-or-unassigned'`).length,0);
  const manual=await j.create(owner,property,'2099-03-24','deep');
  await db`UPDATE turnli_dashboard SET data=jsonb_set(data,'{properties,0,regular}','["Changed future task","Not applicable task"]'::jsonb) WHERE owner_id=${owner}`;
  await save([booking('stay','2099-03-25')]);job=await row('stay');assert.equal(job.date,'2099-03-25');assert.deepEqual(job.tasks,['Applicable task']);assert.equal(job.revision,initialRevision+1);
  await db`UPDATE turnli_calendars SET check_out='11:00' WHERE id=${calendar}`;assert.equal((await row('stay')).time,'11:00:00');
  await db`UPDATE turnli_calendars SET enabled=false WHERE id=${calendar}`;assert.equal((await row('stay')).state,'scheduled');await db`UPDATE turnli_calendars SET enabled=true WHERE id=${calendar}`;
  await save([]);job=await row('stay');assert.equal(job.state,'cancelled');assert(job.auto_cancelled);assert.equal((await j.hostJob(owner,manual.id)).state,'scheduled');
  await save([booking('stay','2099-03-26'),booking('historical','2000-01-01')]);job=await row('stay');assert.equal(job.id,initialId);assert.equal(job.state,'scheduled');assert.equal(await row('historical'),undefined);
  assert(await j.cancel(owner,job.id,job.revision));await save([booking('stay')]);assert.equal((await row('stay')).state,'cancelled');assert.equal((await row('stay')).turnover_attention,false);
  await save([booking('started'),booking('complete')]);job=await row('started');assert.deepEqual(job.tasks,['Changed future task']);assert(await j.check(cleaner.id,job.id,job.revision,0,true));
  await save([booking('started','2099-03-27'),booking('complete')]);job=await row('started');assert.equal(job.date,'2099-03-24');assert(job.turnover_attention);assert.deepEqual(job.checked,[0]);
  // Issues authorize from the actual assignment, not workspace membership or IDs.
  const image=await validatePhoto({type:'image/png',data:(await sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer()).toString('base64')});
  const issueId=randomUUID(),report={category:'maintenance',description:'Synthetic private issue'};
  assert.equal(await i.job(outsider,job.id,false),undefined);assert.equal(await i.job({...host,workspaceId:other},job.id,true),undefined);
  assert.equal(await i.create(outsider.id,job.id,job.revision,randomUUID(),report,image),undefined);
  assert(await i.create(cleaner.id,job.id,job.revision,issueId,report,image));job=await row('started');
  assert.equal(await i.create(cleaner.id,job.id,job.revision,issueId,report,image),undefined);
  assert.equal((await i.list(host,job.id,true)).length,1);assert.equal((await i.list(outsider,job.id,false)).length,0);assert.equal((await i.list({...host,workspaceId:other},job.id,true)).length,0);
  assert(await i.photo(host,job.id,issueId,true));assert.equal(await i.photo(outsider,job.id,issueId,false),undefined);assert.equal(await i.photo({...host,workspaceId:other},job.id,issueId,true),undefined);
  assert.equal((await c.view(cleaner,job.id,false)).photos.length,0);assert.equal(await c.submit(cleaner.id,job.id,job.revision),undefined);
  // An issue by itself marks work started; a draft photo alone also prevents cancellation.
  await save([booking('started'),booking('complete'),booking('issue-only'),booking('photo-only')]);
  const issueOnly=await row('issue-only'),photoOnly=await row('photo-only');assert(await i.create(cleaner.id,issueOnly.id,issueOnly.revision,randomUUID(),report,null));assert(await c.add(cleaner.id,photoOnly.id,photoOnly.revision,image));
  await save([booking('started'),booking('complete')]);assert.equal((await row('issue-only')).state,'scheduled');assert((await row('issue-only')).turnover_attention);assert.equal((await row('photo-only')).state,'scheduled');assert.equal((await c.view(cleaner,photoOnly.id,false)).photos.length,1);
  // A completed clean remains immutable when its source changes or disappears.
  let complete=await row('complete');assert(await j.check(cleaner.id,complete.id,complete.revision,0,true));complete=await row('complete');
  for(const color of ['red','green','blue']){const photo=await validatePhoto({type:'image/png',data:(await sharp({create:{width:4,height:4,channels:3,background:color}}).png().toBuffer()).toString('base64')});assert(await c.add(cleaner.id,complete.id,complete.revision,photo));complete=await row('complete');}
  assert(await c.submit(cleaner.id,complete.id,complete.revision));complete=await row('complete');
  assert.equal(await i.create(cleaner.id,complete.id,complete.revision,randomUUID(),report,null),undefined);
  await save([booking('complete','2099-04-01')]);complete=await row('complete');assert.equal(complete.state,'awaiting_review');assert.equal(complete.date,'2099-03-24');assert(complete.turnover_attention);assert.equal((await c.view(host,complete.id,true)).photos.length,3);
  assert(await c.review(host,complete.id,complete.revision,'approved',null));await save([]);complete=await row('complete');assert.equal(complete.state,'approved');assert.deepEqual(complete.checked,[0]);assert.equal((await c.view(host,complete.id,true)).photos.length,3);assert.equal((await row('started')).state,'scheduled');
  await save([booking('replacement')]);const replacement=await row('replacement');assert(await a.revoke(owner,invitation.id));assert.equal(await j.assigned(cleaner.id,replacement.id),undefined);assert.equal(await i.job(cleaner,job.id,false),undefined);assert.equal(await i.photo(cleaner,job.id,issueId,false),undefined);assert(await i.photo(host,job.id,issueId,true));
  const next=await a.invite(host,property,outsider.email);assert(await a.accept(outsider,next.id));assert.equal((await row('replacement')).cleaner_user_id,outsider.id);assert(await j.assigned(outsider.id,replacement.id));assert.equal(await c.view(outsider,complete.id,false),undefined);
  // Reassignment does not expose the former Cleaner's issue text/photos to another Cleaner.
  assert.equal((await i.list(outsider,job.id,false)).length,0);assert.equal(await i.photo(outsider,job.id,issueId,false),undefined);
  const events=await db`SELECT kind,revision,scheduled_date,state FROM turnli_job_events WHERE owner_id=${owner}`;
  for(const kind of ['job.created','job.changed','job.cancelled','issue.reported','clean.submitted','review.approved'])assert(events.some(e=>e.kind===kind),kind);
  assert(!JSON.stringify(events).includes('Synthetic private issue'));
 }finally{
  // Remove source calendars first so their delete triggers cannot recreate jobs.
  await db`DELETE FROM turnli_calendars WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_cleaning_jobs WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_dashboard WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_cleaner_codes WHERE user_id IN (${cleaner.id},${outsider.id})`;
 }
});
