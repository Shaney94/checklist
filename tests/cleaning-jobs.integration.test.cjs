// Opt-in: uses temporary synthetic records only; always removes them in finally.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createStore}=require('../lib/cleaning-job-store.cjs');
const {createStore:workspaces}=require('../lib/dashboard-store.cjs');
const {createStore:guides}=require('../lib/property-guide-store.cjs');
const {database}=require('../lib/calendar-store.cjs');
test('Neon: property ownership, persistent jobs/tasks/codes, assignment isolation and immediate guide revocation', {skip:process.env.TURNLI_TEST_DATABASE!=='1'},async()=>{
 const db=database(),suffix=randomUUID(),owner='test-jobs:'+suffix,other='test-other:'+suffix,cleaner='test-cleaner:'+suffix,second='test-second:'+suffix;
 const propertyId=randomUUID(),foreignProperty=randomUUID(),store=createStore(db);
 const property=id=>({id,name:'Synthetic test property',phone:'+447700900123',notes:'PRIVATE',regular:['Synthetic task'],deep:['Synthetic deep task'],faqs:[],checked:{regular:[],deep:[]}});
 try{
  await workspaces(db).save(owner,0,{properties:[property(propertyId)]});await workspaces(db).save(other,0,{properties:[property(foreignProperty)]});
  assert.equal(await store.create(owner,foreignProperty,'2026-09-22','regular'),undefined);
  const job=await store.create(owner,propertyId,'2026-09-22','regular');assert(job.id);
  assert.equal(await store.hostJob(other,job.id),undefined);
  const code=await store.rotateCode(cleaner),secondCode=await store.rotateCode(second);assert.equal(await createStore(db).cleaner(code),cleaner);assert.equal(await store.cleaner('a'.repeat(43)),undefined);
  assert.equal(await store.assign(other,job.id,0,cleaner,code),undefined);
  assert.equal(await store.assign(owner,job.id,1,cleaner,code),undefined);
  await guides(db).save(owner,propertyId,0,{access:'Synthetic confidential guide'});
  assert.equal(await store.guide(cleaner,job.id),undefined);
  assert(await store.assign(owner,job.id,0,cleaner,code));
  assert.equal((await createStore(db).guide(cleaner,job.id)).guide.access,'Synthetic confidential guide');
  assert.equal(await store.guide(second,job.id),undefined);assert.equal(await store.assigned(second,job.id),undefined);
  const listed=await store.list({id:cleaner,workspaceId:'not-the-host-workspace'},false);assert.equal(listed.length,1);assert.equal(listed[0].propertyName,'Synthetic test property');assert(!JSON.stringify(listed).includes('PRIVATE'));
  const detail=await store.assigned(cleaner,job.id);assert.deepEqual(detail.tasks,['Synthetic task']);assert(!JSON.stringify(detail).includes('PRIVATE'));
  assert.equal(await store.check(second,job.id,1,0,true),undefined);assert.equal(await store.check(cleaner,job.id,1,99,true),undefined);
  assert(await store.check(cleaner,job.id,1,0,true));assert.deepEqual((await createStore(db).assigned(cleaner,job.id)).checked,[0]);
  assert.equal(await store.check(cleaner,job.id,1,0,false),undefined);
  assert(await store.check(cleaner,job.id,2,0,false));assert.deepEqual((await store.assigned(cleaner,job.id)).checked,[]);
  await store.rotateCode(cleaner);assert.equal(await store.cleaner(code),undefined);assert(await store.guide(cleaner,job.id));
  assert.equal(await store.assign(owner,job.id,3,cleaner,code),undefined);
  assert(await store.check(cleaner,job.id,3,0,true));
  assert(await store.assign(owner,job.id,4,second,secondCode));assert.deepEqual((await store.assigned(second,job.id)).checked,[0]);assert.equal(await store.guide(cleaner,job.id),undefined);assert(await store.guide(second,job.id));
  assert(await store.assign(owner,job.id,5,null,null));assert.equal(await store.guide(second,job.id),undefined);
  assert(await store.assign(owner,job.id,6,second,secondCode));assert(await store.cancel(owner,job.id,7));assert.equal(await store.guide(second,job.id),undefined);assert.equal(await store.assigned(second,job.id),undefined);assert.equal((await store.list({id:second,workspaceId:owner},false)).length,0);
  assert.equal(await store.assign(owner,job.id,8,second,secondCode),undefined);
  // Even a stale job row cannot authorize a property removed from the owning document.
  const orphan=await store.create(owner,propertyId,'2026-09-23','deep');assert(await store.assign(owner,orphan.id,0,second,secondCode));
  await workspaces(db).save(owner,1,{properties:[]});assert.equal(await store.guide(second,orphan.id),undefined);assert.equal(await store.assigned(second,orphan.id),undefined);assert.equal(await store.hostJob(owner,orphan.id),undefined);
 }finally{
  await db`DELETE FROM turnli_dashboard WHERE owner_id IN (${owner},${other})`;
  await db`DELETE FROM turnli_cleaner_codes WHERE user_id IN (${cleaner},${second})`;
 }
});
