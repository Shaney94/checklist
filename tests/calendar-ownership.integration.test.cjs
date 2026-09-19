const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
const {database,createStore,metadata,unseal}=require('../lib/calendar-store.cjs');
const {createStore:workspaces}=require('../lib/dashboard-store.cjs');
const {createStore:jobs}=require('../lib/cleaning-job-store.cjs');
const {createHandler}=require('../src/server/handlers/calendar.js');
const {createHandler:guides}=require('../src/server/handlers/start-guide.js');
const {managedWorkspace}=require('../lib/authorization.cjs');
const response=()=>({setHeader(){},status(c){this.code=c;return this},json(d){this.data=d;return this}});
const request=(body,query={})=>({method:body?'POST':'GET',body,query,headers:{origin:'https://turnli.vercel.app','content-type':'application/json'}});
test('Neon: owned calendar properties persist, legacy feeds stay unlinked, and calendars never grant Host access',{skip:process.env.TURNLI_TEST_DATABASE!=='1'},async()=>{
 // Only synthetic rows are encrypted with this process-local test key.
 const originalKey=process.env.TURNLI_CONTENT_KEY;process.env.TURNLI_CONTENT_KEY=randomBytes(32).toString('base64');
 const db=database(),suffix=randomUUID(),hostOwner='test-host:'+suffix;
 const cleaner={id:'test-cleaner:'+suffix,role:'cleaner',workspaceId:hostOwner},owner=managedWorkspace(cleaner),store=createStore(db);
 const propertyId=randomUUID(),hostProperty=randomUUID();
 const settings={name:'Synthetic own feed',propertyId,platform:'Custom iCal',url:'https://example.com/synthetic-own.ics',checkIn:'15:00',checkOut:'10:00',enabled:true};
 try{
  await workspaces(db).save(owner,0,{properties:[{id:propertyId,name:'Own customer'}]});
  await workspaces(db).save(hostOwner,0,{properties:[{id:hostProperty,name:'Host private property'}]});
  assert.equal(await store.create(owner,{...settings,propertyId:hostProperty},[]),undefined);
  const own=await store.create(owner,settings,[]),host=await store.create(hostOwner,{...settings,propertyId:hostProperty},[]);
  assert.equal((await createStore(db).get(owner,own.id)).property_id,propertyId);
  assert.equal(await store.get(owner,host.id),undefined);
  assert.equal(await store.update(owner,own.id,{...settings,propertyId:hostProperty}),undefined);
  assert.equal(await store.update(owner,own.id,{...settings,propertyId:null}),undefined);
  assert.equal(await store.remove(owner,host.id),false);
  const handler=createHandler(async()=>cleaner,()=>store,undefined,()=>({seen:async()=>new Set()}),()=>workspaces(db));
  let r=response();await handler(request(),r);assert.equal(r.code,200);assert.deepEqual(r.data.calendars.map(c=>c.id),[own.id]);
  r=response();await handler(request(undefined,{action:'subscription',id:host.id,workspaceId:hostOwner}),r);assert.equal(r.code,400);assert(!r.data.url);
  for(const action of ['update','remove','refresh']){r=response();await handler(request({action,id:host.id,...settings,workspaceId:hostOwner}),r);assert.equal(r.code,404);}
  r=response();await handler(request(undefined,{action:'subscription',id:own.id}),r);assert.equal(r.data.url,settings.url);
  const guideHandler=guides(async()=>cleaner,()=>assert.fail('Host data accessed'),()=>assert.fail('Host guide accessed'),()=>jobs(db));
  r=response();await guideHandler(request(undefined,{id:hostProperty,calendarId:own.id}),r);assert.equal(r.code,403);
  r=response();await guideHandler(request(undefined,{jobId:own.id,id:hostProperty}),r);assert.equal(r.code,404);
  // Simulate a pre-migration feed without guessing any property association.
  await db`UPDATE turnli_calendars SET property_id=NULL WHERE id=${own.id} AND owner_id=${owner}`;
  assert.equal(metadata(await store.get(owner,own.id)).propertyId,null);
  r=response();await handler(request({action:'update',id:own.id,name:'Renamed legacy',checkIn:'15:00',checkOut:'10:00'}),r);assert.equal(r.code,200);
  assert.equal((await store.get(owner,own.id)).property_id,null);
  r=response();await handler(request({action:'update',id:own.id,name:'Linked explicitly',propertyId}),r);assert.equal(r.code,200);
  const saved=await createStore(db).get(owner,own.id);assert.equal(saved.property_id,propertyId);assert.equal(unseal(saved.encrypted_url,owner),settings.url);
 }finally{
  if(originalKey===undefined)delete process.env.TURNLI_CONTENT_KEY;else process.env.TURNLI_CONTENT_KEY=originalKey;
  await db`DELETE FROM turnli_calendars WHERE owner_id IN (${owner},${hostOwner})`;
  await db`DELETE FROM turnli_dashboard WHERE owner_id IN (${owner},${hostOwner})`;
 }
});
