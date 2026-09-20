const {enabled}=require('./fixtures/integration-db.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {database}=require('../lib/calendar-store.cjs'),{createStore:contexts}=require('../lib/cleaner-context-store.cjs'),{createStore:assignments}=require('../lib/property-assignment-store.cjs'),{createStore:jobs}=require('../lib/cleaning-job-store.cjs');
test('PostgreSQL: Cleaner property context, all calendars and encrypted code preserve isolation and assignments',{skip:!enabled},async()=>{
 const db=database(),cleaner={id:randomUUID(),email:randomUUID()+'@example.test'},other={id:randomUUID(),email:randomUUID()+'@example.test'},owner='test:'+randomUUID(),own='user:'+cleaner.id,foreign='test:'+randomUUID();
 const ids=[randomUUID(),randomUUID(),randomUUID()],a=assignments(db),j=jobs(db),c=contexts(db);
 try{
  for(const [n,o] of [owner,own,foreign].entries())await db`INSERT INTO turnli_dashboard(owner_id,data) VALUES(${o},${JSON.stringify({properties:[{id:ids[n],name:'Duke Street',regular:['Clean','Not needed'],deep:['Deep'],notApplicable:{regular:[1],deep:[]},notes:'private access',phone:'private phone',checked:{regular:[],deep:[]}}]})}::jsonb)`;
  const initial=await j.ensureCode(cleaner.id);assert.match(initial.code,/^[A-Za-z0-9_-]{43}$/);assert.deepEqual(await j.ensureCode(cleaner.id),initial);assert.equal(await j.cleaner(initial.code),cleaner.id);
  const raw=(await db`SELECT * FROM turnli_cleaner_codes WHERE user_id=${cleaner.id}`)[0];assert(!JSON.stringify(raw).includes(initial.code));
  assert.deepEqual((await c.properties(cleaner)).map(p=>p.id),[ids[1]]);
  const invitation=await a.invite({id:'host',workspaceId:owner},ids[0],cleaner.email);assert.equal((await a.inbox(cleaner)).length,1);
  assert.equal((await c.properties(cleaner)).length,1);assert.equal(await a.accept(other,invitation.id),undefined);await a.accept(cleaner,invitation.id);
  const context=await c.properties(cleaner);assert.equal(context.length,2);const host=context.find(p=>p.id===ids[0]);assert.equal(host.source,'assigned');assert.deepEqual(host.regular,['Clean','Not needed']);assert.deepEqual(host.notApplicable.regular,[1]);assert.equal(host.notes,undefined);assert.equal(host.phone,undefined);assert.equal((await c.properties(other)).length,0);
  for(const [o,p] of [[owner,ids[0]],[foreign,ids[2]]])await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash) VALUES(${randomUUID()},${o},${p},'Synthetic','Custom iCal','example.test','private',${randomUUID()})`;
  assert.equal((await a.calendars(cleaner.id,'all')).length,1);assert.equal((await a.calendars(other.id,'all')).length,0);
  const job=await j.create(owner,ids[0],'2026-10-01','regular');assert(await j.assigned(cleaner.id,job.id));
  const replacement=await j.rotateCode(cleaner.id);assert.notEqual(replacement,initial.code);assert.equal(await j.cleaner(initial.code),undefined);assert(await j.assigned(cleaner.id,job.id));assert.equal((await a.inbox(cleaner))[0].state,'active');
  await a.revoke(owner,invitation.id);assert.equal((await c.properties(cleaner)).length,1);assert.equal((await a.calendars(cleaner.id,'all')).length,0);assert.equal(await j.assigned(cleaner.id,job.id),undefined);
  await db`UPDATE turnli_cleaner_codes SET encrypted_code=NULL WHERE user_id=${cleaner.id}`;assert.deepEqual(await j.ensureCode(cleaner.id),{code:null,legacy:true});assert.equal(await j.cleaner(replacement),cleaner.id);
 }finally{for(const o of [owner,own,foreign])await db`DELETE FROM turnli_dashboard WHERE owner_id=${o}`;await db`DELETE FROM turnli_cleaner_codes WHERE user_id=${cleaner.id} OR user_id=${other.id}`;}
});
