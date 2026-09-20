const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),sharp=require('sharp');
const {database}=require('../lib/calendar-store.cjs'),{createStore:workspaces}=require('../lib/dashboard-store.cjs'),{createStore:jobs}=require('../lib/cleaning-job-store.cjs'),{createStore:assignments}=require('../lib/property-assignment-store.cjs'),{createStore:completion}=require('../lib/completion-store.cjs');
const {change}=require('../src/server/handlers/dashboard.js'),{templates}=require('../lib/checklist-templates.cjs'),{validatePhoto}=require('../lib/completion.cjs');
test('Neon: property adoption persists applicability, preserves job/evidence snapshots and supplies new turnovers',{skip:process.env.TURNLI_TEST_DATABASE!=='1'},async()=>{
 const db=database(),owner='test-adoption:'+randomUUID(),property=randomUUID(),cleaner={id:'test-cleaner:'+randomUUID(),email:randomUUID()+'@example.test'},host={id:'synthetic-host',workspaceId:owner};
 const w=workspaces(db),j=jobs(db),a=assignments(db),c=completion(db);
 try{
  await w.save(owner,0,{properties:[{id:property,name:'Synthetic adoption',regular:[templates.regular[7],templates.regular[2]],deep:['Earlier deep task'],checked:{regular:[],deep:[]},notApplicable:{regular:[0],deep:[]}}]});
  const invite=await a.invite(host,property,cleaner.email);assert(await a.accept(cleaner,invite.id));
  const planned=await j.create(owner,property,'2099-06-20','regular'),submitted=await j.create(owner,property,'2099-06-21','deep');
  assert(await j.check(cleaner.id,planned.id,0,0,true));assert(await j.check(cleaner.id,submitted.id,0,0,true));
  let revision=1;
  for(const color of ['red','green','blue']){const bytes=await sharp({create:{width:2,height:2,channels:3,background:color}}).png().toBuffer();revision=(await c.add(cleaner.id,submitted.id,revision,await validatePhoto({type:'image/png',data:bytes.toString('base64')}))).revision;}
  assert(await c.submit(cleaner.id,submitted.id,revision));const pending=await c.view(host,submitted.id,true);assert(await c.review(host,submitted.id,pending.revision,'approved',null));
  const snapshots=()=>db`SELECT to_jsonb(j) AS job,(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM turnli_cleaning_job_photos f WHERE f.job_id=j.id) AS evidence FROM turnli_cleaning_jobs j WHERE j.owner_id=${owner} ORDER BY j.id`;
  const before=await snapshots();let saved=await w.load(owner);
  for(const kind of ['regular','deep'])saved=await w.save(owner,saved.revision,change(saved.data,{action:'template',id:property,kind}));
  assert.deepEqual(await snapshots(),before);
  const persisted=(await workspaces(db).load(owner)).data.properties[0];assert.equal(persisted.regular.length,38);assert.equal(persisted.deep.length,109);assert.deepEqual(persisted.notApplicable.regular,[7]);
  const bookings=[{id:'synthetic-turnover',arrival:{date:'2099-06-22',allDay:true},checkout:{date:'2099-06-24',allDay:true}}];
  await db`INSERT INTO turnli_calendars(id,owner_id,property_id,display_name,platform,feed_host,encrypted_url,url_hash,bookings) VALUES(${randomUUID()},${owner},${property},'Synthetic','Custom iCal','example.test','synthetic',${randomUUID()},${JSON.stringify(bookings)}::jsonb)`;
  const [turnover]=await db`SELECT tasks,cleaner_user_id FROM turnli_cleaning_jobs WHERE owner_id=${owner} AND reservation_key='synthetic-turnover'`;assert.deepEqual(turnover.tasks,templates.regular.filter((_,i)=>i!==7));assert.equal(turnover.cleaner_user_id,cleaner.id);
  const deep=await j.create(owner,property,'2099-06-25','deep');assert.deepEqual((await j.assigned(cleaner.id,deep.id)).tasks,templates.deep);
 }finally{
  await db`DELETE FROM turnli_calendars WHERE owner_id=${owner}`;await db`DELETE FROM turnli_cleaning_jobs WHERE owner_id=${owner}`;await db`DELETE FROM turnli_dashboard WHERE owner_id=${owner}`;await db`DELETE FROM turnli_cleaner_codes WHERE user_id=${cleaner.id}`;
 }
});
