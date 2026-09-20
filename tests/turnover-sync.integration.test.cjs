const {enabled}=require('./fixtures/integration-db.cjs');
// Synthetic records only. Exercise actual sync/store/trigger boundaries; no external feeds.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
process.env.TURNLI_CONTENT_KEY=randomBytes(32).toString('base64');
const {database,createStore:calendars}=require('../lib/calendar-store.cjs'),{parse,syncOne}=require('../lib/calendar-sync.cjs'),{createStore:assignments}=require('../lib/property-assignment-store.cjs'),{createStore:jobs}=require('../lib/cleaning-job-store.cjs');
const {change}=require('../src/server/handlers/dashboard.js');
const feed=(entries)=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+entries.map(([id,cancelled])=>'BEGIN:VEVENT\r\nUID:'+id+'\r\nDTSTART;VALUE=DATE:20990620\r\nDTEND;VALUE=DATE:20990624\r\n'+(cancelled?'STATUS:CANCELLED\r\n':'')+'END:VEVENT').join('\r\n')+'\r\nEND:VCALENDAR';
test('PostgreSQL: active stays survive revocation/partial sync, confirmed cancellations persist, repeated sync is idempotent',{skip:!enabled},async()=>{
 const db=database(),owner='test-sync:'+randomUUID(),host={id:'synthetic-host',workspaceId:owner},cleaner={id:'test-cleaner:'+randomUUID(),email:randomUUID()+'@example.test'},next={id:'test-cleaner:'+randomUUID(),email:randomUUID()+'@example.test'},a=assignments(db),j=jobs(db),c=calendars(db);
 const data=change({properties:[]},{action:'property',name:'Synthetic property',phone:'',notes:''}),property=data.properties[0].id,settings={propertyId:property,name:'Synthetic',url:'https://example.test/synthetic.ics',platform:'Custom iCal',checkIn:'15:00',checkOut:'10:00'};
 let calendar;
 const list=()=>j.list(host,true);
 const sync=async text=>{await db`UPDATE turnli_calendars SET last_attempt=NULL WHERE id=${calendar.id}`;return syncOne(c,owner,calendar.id,async()=>{if(text instanceof Error)throw text;return text;});};
 try{
  await db`INSERT INTO turnli_dashboard(owner_id,data) VALUES(${owner},${JSON.stringify(data)}::jsonb)`;
  const invitation=await a.invite(host,property,cleaner.email);assert(await a.accept(cleaner,invitation.id));
  const active=feed([['one'],['two']]);calendar=await c.create(owner,settings,parse(active,settings));let original=await list();assert.equal(original.length,2);assert(original.every(x=>x.state==='scheduled'&&x.assigned));assert.equal((await j.assigned(cleaner.id,original[0].id)).tasks.length,38);
  await sync(active);await sync(active);assert.deepEqual(await list(),original);
  // One missing snapshot is not enough. Recovery clears pending removals without job churn.
  await sync(feed([['one']]));assert.deepEqual(await list(),original);assert.equal((await c.get(owner,calendar.id)).pending_removals.length,1);
  await sync(new Error('Synthetic offline'));assert.deepEqual(await list(),original);
  assert.equal((await sync(active.replace('END:VCALENDAR',''))).ok,false);assert.deepEqual(await list(),original);
  await sync(active);assert.deepEqual(await list(),original);assert.deepEqual((await c.get(owner,calendar.id)).pending_removals,[]);
  // Losing the Cleaner relationship is not a cancelled reservation; access still disappears.
  assert(await a.revoke(owner,invitation.id));assert((await list()).every(x=>x.state==='scheduled'&&!x.assigned));assert.equal(await j.assigned(cleaner.id,original[0].id),undefined);
  const pending=await a.invite(host,property,next.email);assert((await list()).every(x=>x.state==='scheduled'&&!x.assigned));
  // Reproduce an old revocation-caused cancellation. An unconfirmed absence must not revive it.
  await db`UPDATE turnli_cleaning_jobs SET state='cancelled',auto_cancelled=true WHERE owner_id=${owner}`;
  await sync(feed([]));assert((await list()).every(x=>x.state==='cancelled'));
  await sync(active);assert((await list()).every(x=>x.state==='scheduled'&&!x.assigned));
  assert(await a.accept(next,pending.id));assert((await list()).every(x=>x.state==='scheduled'&&x.assigned));assert(await j.assigned(next.id,original[0].id));
  // A vanished UID cancels only after a second complete successful absence.
  await sync(feed([['one']]));assert((await list()).every(x=>x.state==='scheduled'));
  await sync(feed([['one']]));assert.equal((await list()).filter(x=>x.state==='cancelled').length,1);
  let cancelled=await list();await sync(feed([['one']]));assert.deepEqual(await list(),cancelled);assert.equal(cancelled.length,2);
  // STATUS:CANCELLED is direct evidence; no second absence is needed.
  await sync(feed([['one',true]]));assert((await list()).every(x=>x.state==='cancelled'));cancelled=await list();await sync(feed([['one',true]]));assert.deepEqual(await list(),cancelled);
 }finally{
  await db`DELETE FROM turnli_calendars WHERE owner_id=${owner}`;await db`DELETE FROM turnli_cleaning_jobs WHERE owner_id=${owner}`;await db`DELETE FROM turnli_dashboard WHERE owner_id=${owner}`;await db`DELETE FROM turnli_cleaner_codes WHERE user_id IN (${cleaner.id},${next.id})`;
 }
});
