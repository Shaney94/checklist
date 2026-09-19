// Optional integration test against the configured real database, isolated by a random test owner.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {database,createStore}=require('../lib/calendar-store.cjs');
const {syncOne,validate}=require('../lib/calendar-sync.cjs');
const {createHandler}=require('../src/server/handlers/calendar');
const {createStore:workspaceStore}=require('../lib/dashboard-store.cjs');
const owner='test:'+randomUUID(),other='test:'+randomUUID();
const event=(id,start,end,extra='')=>`BEGIN:VEVENT\r\nUID:${id}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:Reserved 2 guests\r\n${extra}END:VEVENT`;
const feed=events=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+events.join('\r\n')+'\r\nEND:VCALENDAR';
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(d){this.data=d;return this}};}
(async()=>{
 const db=database(),store=createStore();let id;
 try{
  const propertyId=randomUUID();
  await workspaceStore(db).save(owner,0,{properties:[{id:propertyId,name:'Synthetic calendar property'}]});
  let source=feed([event('first','20261001','20261004')]);
  const settings={propertyId,name:'Integration test',platform:'Custom iCal',url:'https://example.com/synthetic-calendar.ics',checkIn:'15:00',checkOut:'10:00'};
  const row=await store.create(owner,settings,await validate(settings,async()=>source));id=row.id;
  assert.equal((await createStore().list(owner)).length,1);assert.equal((await createStore().get(owner,id)).bookings.length,1);
  source=feed([event('first','20261001','20261004'),event('future','20261010','20261013')]);
  const eligible=()=>db`UPDATE turnli_calendars SET last_attempt=now()-interval '10 minutes' WHERE owner_id=${owner} AND id=${id}`;
  await eligible();assert((await syncOne(createStore(),owner,id,async()=>source)).ok);
  assert.equal((await createStore().get(owner,id)).bookings.length,2);
  await eligible();await syncOne(createStore(),owner,id,async()=>source);assert.equal((await store.get(owner,id)).bookings.length,2);
  source=feed([event('first','20261001','20261005'),event('future','20261010','20261013','STATUS:CANCELLED\r\n')]);
  await eligible();await syncOne(store,owner,id,async()=>source);let current=await store.get(owner,id);assert.equal(current.bookings.length,1);assert.equal(current.bookings[0].checkout.date,'2026-10-05');
  await eligible();await syncOne(store,owner,id,async()=>{throw Error('outage')});current=await store.get(owner,id);assert.equal(current.bookings.length,1);assert(current.sync_error);assert(current.last_success);
  const second=await store.create(owner,{...settings,name:'Second calendar',url:'https://example.com/second-synthetic.ics'},[]);assert.equal((await createStore().list(owner)).length,2);
  const foreign=res();await createHandler(async()=>({id:'synthetic-host',role:'host',workspaceId:other}),()=>createStore())({method:'GET',query:{id},headers:{}},foreign);assert.equal(foreign.code,404);
  const refreshedSession=res();await createHandler(async()=>({id:'synthetic-host',role:'host',workspaceId:owner}),()=>createStore())({method:'GET',query:{},headers:{}},refreshedSession);assert.equal(refreshedSession.data.calendars.length,2);assert.equal(refreshedSession.data.bookings.length,1);assert(!JSON.stringify(refreshedSession.data).includes('synthetic-calendar.ics'));
  assert.equal(await store.remove(other,id),false);assert(await store.remove(owner,id));assert.equal(await createStore().get(owner,id),undefined);assert(await store.remove(owner,second.id));
  console.log('PASS real database: persisted reconnect, future booking, repeat sync without duplicates, changed/cancelled booking, outage retention, multiple calendars, cross-account isolation and deletion.');
 }finally{await db`DELETE FROM turnli_calendars WHERE owner_id=${owner}`;await db`DELETE FROM turnli_dashboard WHERE owner_id=${owner}`;}
})().catch(e=>{console.error('Persistence integration check failed:',e.name,e.code||'');process.exitCode=1;});
