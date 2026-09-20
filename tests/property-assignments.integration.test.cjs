const {enabled}=require('./fixtures/integration-db.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {database}=require('../lib/calendar-store.cjs'),{createStore:assignments}=require('../lib/property-assignment-store.cjs'),{createStore:jobs}=require('../lib/cleaning-job-store.cjs'),{createStore:completion}=require('../lib/completion-store.cjs');
const {validatePhoto}=require('../lib/completion.cjs'),sharp=require('sharp');
test('PostgreSQL: email acceptance, property defaults, isolated calendars, evidence and revocation',{skip:!enabled},async()=>{
 const db=database(),owner='test-assignment:'+randomUUID(),other='test-other:'+randomUUID(),property=randomUUID(),foreign=randomUUID();
 const host={id:'host',workspaceId:owner},cleaner={id:'test-cleaner:'+randomUUID(),email:'synthetic-'+randomUUID()+'@example.test'},outsider={id:'test-cleaner:'+randomUUID(),email:'other-'+randomUUID()+'@example.test'};
 const a=assignments(db),j=jobs(db),c=completion(db);
 try{
  for(const [workspace,p] of [[owner,property],[other,foreign]])await db`INSERT INTO turnli_dashboard(owner_id,data) VALUES(${workspace},${JSON.stringify({properties:[{id:p,name:'Synthetic property',regular:['Task A','Task B'],deep:['Deep task'],notApplicable:{regular:[1],deep:[]},faqs:[],checked:{regular:[],deep:[]}}]})}::jsonb)`;
  assert.equal(await a.invite({...host,workspaceId:other},property,cleaner.email),undefined);
  const existing=await j.create(owner,property,'2026-09-20','regular');
  const invitation=await a.invite(host,property,cleaner.email);assert(invitation);assert.equal((await a.inbox(outsider)).length,0);assert.equal(await a.accept(outsider,invitation.id),undefined);assert.equal(await a.guide(cleaner.id,invitation.id),undefined);
  assert.equal(await a.invite(host,property,outsider.email),undefined);
  const [accepted,duringAccept]=await Promise.all([a.accept(cleaner,invitation.id),j.create(owner,property,'2026-09-23','regular')]);assert(accepted);assert(await j.assigned(cleaner.id,duringAccept.id));assert.equal(await a.accept(cleaner,invitation.id),undefined);
  let job=await j.assigned(cleaner.id,existing.id);assert(job);assert.deepEqual(job.tasks,['Task A']);assert.equal(await j.assigned(outsider.id,existing.id),undefined);
  const next=await j.create(owner,property,'2026-09-21','deep');assert(await j.assigned(cleaner.id,next.id));assert(await a.guide(cleaner.id,invitation.id));assert.equal(await a.guide(outsider.id,invitation.id),undefined);
  for(const [workspace,p,enabled] of [[owner,property,true],[owner,null,true],[other,foreign,true]])await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash,bookings,enabled) VALUES(${randomUUID()},${workspace},${p},'Synthetic','Custom iCal','example.test','synthetic-private',${randomUUID()},'[]'::jsonb,${enabled})`;
  const calendars=await a.calendars(cleaner.id,invitation.id);assert.equal(calendars.length,1);assert(calendars[0].id);assert.equal(calendars[0].encrypted_url,undefined);assert.equal((await a.calendars(outsider.id,invitation.id)).length,0);
  assert.equal(await a.revoke(other,invitation.id),undefined);
  await j.check(cleaner.id,existing.id,job.revision,0,true);job=await j.assigned(cleaner.id,existing.id);
  for(const color of ['red','green','blue']){const bytes=await sharp({create:{width:4,height:4,channels:3,background:color}}).png().toBuffer();const photo=await validatePhoto({type:'image/png',data:bytes.toString('base64')});const added=await c.add(cleaner.id,existing.id,job.revision,photo);job.revision=added.revision;}
  assert(await c.submit(cleaner.id,existing.id,job.revision));const evidence=await c.view(cleaner,existing.id,false);assert.equal(evidence.photos.length,3);
  const [revoked,duringRevoke]=await Promise.all([a.revoke(owner,invitation.id),j.create(owner,property,'2026-09-24','regular')]);assert(revoked);assert.equal(await j.assigned(cleaner.id,duringRevoke.id),undefined);assert.equal((await a.inbox(cleaner)).length,0);assert.equal(await a.guide(cleaner.id,invitation.id),undefined);assert.equal((await a.calendars(cleaner.id,invitation.id)).length,0);
  assert.equal(await j.assigned(cleaner.id,existing.id),undefined);assert.equal(await j.assigned(cleaner.id,next.id),undefined);assert.equal(await j.check(cleaner.id,next.id,0,0,true),undefined);assert.equal(await c.view(cleaner,existing.id,false),undefined);assert.equal(await c.photo(cleaner,existing.id,evidence.photos[0].id,false),undefined);
  const hostEvidence=await c.view(host,existing.id,true);assert.equal(hostEvidence.photos.length,3);assert(await c.review(host,existing.id,hostEvidence.revision,'approved',null));
  const unassigned=await j.create(owner,property,'2026-09-22','regular');assert.equal(await j.assigned(cleaner.id,unassigned.id),undefined);
  const replacement=await a.invite(host,property,outsider.email);assert(await a.accept(outsider,replacement.id));assert(await j.assigned(outsider.id,next.id));assert(await j.assigned(outsider.id,unassigned.id));assert.equal(await c.view(outsider,existing.id,false),undefined);
  assert.equal(await a.revoke(owner,invitation.id),undefined);assert(await j.assigned(outsider.id,next.id));
  assert(await a.revoke(owner,replacement.id));const returned=await a.invite(host,property,cleaner.email);assert(await a.accept(cleaner,returned.id));
  assert.equal(await a.revoke(owner,invitation.id),undefined);assert(await j.assigned(cleaner.id,next.id));assert(await a.guide(cleaner.id,returned.id));
  const invitation2=await a.invite({...host,workspaceId:other},foreign,cleaner.email);await db`UPDATE turnli_property_assignments SET expires_at=now()-interval '1 hour' WHERE id=${invitation2.id}`;assert.equal(await a.accept(cleaner,invitation2.id),undefined);
  const invitation3=await a.invite({...host,workspaceId:other},foreign,cleaner.email);assert(await a.decline(cleaner,invitation3.id));assert.equal(await a.accept(cleaner,invitation3.id),undefined);
 }finally{
  // Jobs reference assignments: delete jobs first; submitted photos cascade.
  await db`DELETE FROM turnli_cleaning_jobs WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_calendars WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_dashboard WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_cleaner_codes WHERE user_id IN (${cleaner.id},${outsider.id})`;
 }
});
