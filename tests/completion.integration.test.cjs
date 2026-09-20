const {enabled}=require('./fixtures/integration-db.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {database}=require('../lib/calendar-store.cjs');
const {createStore:workspaceStore}=require('../lib/dashboard-store.cjs');
const {createStore:jobStore}=require('../lib/cleaning-job-store.cjs');
const {createStore}=require('../lib/completion-store.cjs');
const {validatePhoto}=require('../lib/completion.cjs');
test('PostgreSQL: completion requirements, photo isolation, immutable submission, review transitions and concurrent writes',{skip:!enabled},async()=>{
 const db=database(),suffix=randomUUID(),owner='test-completion:'+suffix,propertyId=randomUUID(),cleaner={id:'cleaner:'+suffix,workspaceId:'user:synthetic',role:'cleaner'},other={id:'other:'+suffix,workspaceId:owner,role:'cleaner'},host={id:'host:'+suffix,workspaceId:owner,role:'host'},foreign={...host,workspaceId:'foreign:'+suffix};
 const jobs=jobStore(db),store=createStore(db);
 try{
  await workspaceStore(db).save(owner,0,{properties:[{id:propertyId,name:'Synthetic completion property',regular:['Task one','Task two'],deep:[],faqs:[]}]});
  const code=await jobs.rotateCode(cleaner.id),otherCode=await jobs.rotateCode(other.id);
  const job=await jobs.create(owner,propertyId,'2026-09-19','regular');await jobs.assign(owner,job.id,0,cleaner.id,code);
  const image=async color=>validatePhoto({type:'image/png',data:(await sharp({create:{width:64,height:64,channels:3,background:color}}).png().toBuffer()).toString('base64')});
  const photos=await Promise.all(['red','green','blue','yellow','purple','black','white'].map(image));
  assert.equal(await store.view(other,job.id,false),undefined);assert.equal(await store.view(host,job.id,true),undefined);
  assert.equal(await store.add(other.id,job.id,1,photos[0]),undefined);
  assert.equal(await store.submit(cleaner.id,job.id,1),undefined);
  assert(await jobs.check(cleaner.id,job.id,1,0,true));assert(await jobs.check(cleaner.id,job.id,2,1,true));
  assert.equal(await store.submit(cleaner.id,job.id,3),undefined);
  assert(await store.add(cleaner.id,job.id,3,photos[0]));assert.equal(await store.add(cleaner.id,job.id,4,photos[0]),undefined);
  assert(await store.add(cleaner.id,job.id,4,photos[1]));assert.equal(await store.submit(cleaner.id,job.id,5),undefined);
  // Two uploads with the same revision serialize: only one can succeed.
  const competing=await Promise.all([store.add(cleaner.id,job.id,5,photos[2]),store.add(cleaner.id,job.id,5,photos[3])]);assert.equal(competing.filter(Boolean).length,1);
  let view=await createStore(db).view(cleaner,job.id,false);assert.equal(view.photos.length,3);assert.deepEqual(view.checked,[0,1]);
  const photoId=view.photos[0].id;
  assert.equal(await store.photo(other,job.id,photoId,false),undefined);assert.equal(await store.photo(foreign,job.id,photoId,true),undefined);assert.equal(await store.photo(host,job.id,photoId,true),undefined);assert(await store.photo(cleaner,job.id,photoId,false));
  assert.equal(await store.remove(other.id,job.id,6,photoId),undefined);
  assert(await store.remove(cleaner.id,job.id,6,photoId));assert.equal(await store.photo(cleaner,job.id,photoId,false),undefined);
  assert(await store.add(cleaner.id,job.id,7,photos[0]));
  const before=await store.view(cleaner,job.id,false);assert(await store.submit(cleaner.id,job.id,8));
  const submitted=await createStore(db).view(host,job.id,true);assert.equal(submitted.state,'awaiting_review');assert(submitted.submittedAt);assert.deepEqual(submitted.photos,before.photos);assert.deepEqual(submitted.tasks,before.tasks);
  assert(await store.photo(host,job.id,submitted.photos[0].id,true));assert.equal(await store.photo(foreign,job.id,submitted.photos[0].id,true),undefined);
  assert.equal(await jobs.check(cleaner.id,job.id,9,0,false),undefined);assert.equal(await store.add(cleaner.id,job.id,9,photos[4]),undefined);assert.equal(await store.remove(cleaner.id,job.id,9,submitted.photos[0].id),undefined);assert.equal(await store.submit(cleaner.id,job.id,9),undefined);
  assert.equal(await jobs.assign(owner,job.id,9,other.id,otherCode),undefined);assert.equal(await jobs.cancel(owner,job.id,9),undefined);
  assert.equal(await store.review(foreign,job.id,9,'approved',null),undefined);
  assert(await store.review(host,job.id,9,'issue_reported','Synthetic issue'));assert.equal(await store.review(host,job.id,10,'approved',null),undefined);
  view=await store.view(cleaner,job.id,false);assert.equal(view.state,'issue_reported');assert.equal(view.reviewNote,'Synthetic issue');assert.deepEqual(view.photos,before.photos);assert.equal(await store.add(cleaner.id,job.id,10,photos[4]),undefined);
  // Empty checklists cannot be submitted even with sufficient photos; caps hold.
  const empty=await jobs.create(owner,propertyId,'2026-09-20','deep');await jobs.assign(owner,empty.id,0,cleaner.id,code);
  for(let i=0;i<6;i++)assert(await store.add(cleaner.id,empty.id,i+1,photos[i]));
  assert.equal(await store.add(cleaner.id,empty.id,7,photos[6]),undefined);assert.equal(await store.submit(cleaner.id,empty.id,7),undefined);
  assert(await jobs.assign(owner,empty.id,7,other.id,otherCode));assert.equal((await store.view(other,empty.id,false)).photos.length,0);assert.equal((await db`SELECT count(*)::integer AS n FROM turnli_cleaning_job_photos WHERE job_id=${empty.id}`)[0].n,0);
  // Approve is a separate final state and cannot be silently changed to an issue.
  const approved=await jobs.create(owner,propertyId,'2026-09-21','regular');await jobs.assign(owner,approved.id,0,cleaner.id,code);
  await jobs.check(cleaner.id,approved.id,1,0,true);await jobs.check(cleaner.id,approved.id,2,1,true);
  for(let i=0;i<3;i++)await store.add(cleaner.id,approved.id,i+3,photos[i]);
  const race=await Promise.all([store.submit(cleaner.id,approved.id,6),jobs.check(cleaner.id,approved.id,6,0,false)]);assert.equal(race.filter(Boolean).length,1);
  let current=await store.view(cleaner,approved.id,false);
  if(current.state==='scheduled'){assert(await jobs.check(cleaner.id,approved.id,current.revision,0,true));current=await store.view(cleaner,approved.id,false);assert(await store.submit(cleaner.id,approved.id,current.revision));}
  current=await store.view(host,approved.id,true);assert(await store.review(host,approved.id,current.revision,'approved',null));assert.equal((await store.view(host,approved.id,true)).state,'approved');assert.equal(await store.review(host,approved.id,current.revision+1,'issue_reported','Overwrite'),undefined);
 }finally{
  await db`DELETE FROM turnli_dashboard WHERE owner_id=${owner}`;
  await db`DELETE FROM turnli_cleaner_codes WHERE user_id IN (${cleaner.id},${other.id})`;
 }
});
