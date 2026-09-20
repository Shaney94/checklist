const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler,operationalCalendar}=require('../src/server/handlers/property-assignments.js');
const {deliverInvitation}=require('../lib/property-invitations.cjs');
const {change}=require('../src/server/handlers/dashboard.js');
const {templates}=require('../lib/checklist-templates.cjs');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const host={id:'host',workspaceId:'host-workspace',role:'host',email:'host@example.test'},cleaner={id:'cleaner',workspaceId:'user:cleaner',role:'cleaner',email:'cleaner@example.test'};
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}};}
async function call(user,store,body,query={},deliver=()=>assert.fail('email not expected')){const r=res();await createHandler(async()=>user,()=>store,deliver)({method:body?'POST':'GET',headers:{origin:'https://turnli.io','content-type':'application/json'},body,query},r);return r;}
test('property invitation boundary requires authentication, supported roles and correct action',async()=>{
 assert.equal((await call(null,{})).code,401);assert.equal((await call({...cleaner,role:null},{})).code,403);
 for(const [user,action] of [[host,'accept'],[host,'decline'],[cleaner,'invite'],[cleaner,'revoke']])assert.equal((await call(user,{},{action,id})).code,403);
 const r=res();await createHandler(()=>assert.fail('auth should not run'))({method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'}},r);assert.equal(r.code,403);
});
test('Host invitation scopes property before delivery; normalized email never assigns roles/passwords',async()=>{
 const calls=[];const store={invite:async(u,p,e)=>{assert.deepEqual(u,host);assert.equal(p,id);assert.equal(e,cleaner.email);return {id}},delivered:async(...args)=>calls.push(args)};
 const r=await call(host,store,{action:'invite',propertyId:id,email:' Cleaner@Example.Test ',owner:'foreign'}, {},async e=>{assert.equal(e,cleaner.email)});assert.equal(r.code,201);assert.deepEqual(calls,[[host.workspaceId,id,true]]);
 assert.equal((await call(host,{invite:async()=>null},{action:'invite',propertyId:id,email:cleaner.email})).code,409);
 const failed=await call(host,store,{action:'invite',propertyId:id,email:cleaner.email},{},async()=>{throw Error('private upstream')});assert.equal(failed.code,503);assert(!JSON.stringify(failed.data).includes('private upstream'));assert.equal(calls.at(-1)[2],false);
});
test('Cleaner acceptance and reads use authenticated identity, not caller ownership or claims',async()=>{
 const r=await call(cleaner,{accept:async(u,i)=>{assert.deepEqual(u,cleaner);assert.equal(i,id);return {id}}},{action:'accept',id,email:'other@example.test',workspaceId:host.workspaceId});assert.equal(r.code,200);
 const denied=await call(cleaner,{guide:async(u,i)=>{assert.equal(u,cleaner.id);assert.equal(i,id);return null}},undefined,{action:'guide',id});assert.equal(denied.code,404);
 assert.equal((await call(cleaner,{calendars:async()=>[]},undefined,{action:'calendar',id})).code,404);
});
test('Descope invitations use email links without passwords, role or tenant grants',async()=>{
 for(const exists of [true,false]){
  let sent=false;const sdk={management:{user:{load:async e=>{assert.equal(e,cleaner.email);return exists?{ok:true,data:{userId:'existing',email:e,verifiedEmail:true}}:{ok:false,code:404}}}},magicLink:{signUpOrIn:{email:async(...args)=>{assert.deepEqual(args,[cleaner.email,'https://turnli.io/?join=1']);sent=true;return {ok:true}}}}};
  await deliverInvitation(cleaner.email,sdk);assert(sent);
 }
 for(const data of [{userId:'host',email:cleaner.email,roleNames:['turnli-host']},{userId:'disabled',email:cleaner.email,status:'disabled'}])await assert.rejects(deliverInvitation(cleaner.email,{management:{user:{load:async()=>({ok:true,data})}},magicLink:{signUpOrIn:{email:()=>assert.fail('must not send')}}}));
 await assert.rejects(deliverInvitation(cleaner.email,{management:{user:{load:async()=>({ok:false,code:503})}}}));
});
test('operational calendar explicitly excludes guest names, raw UIDs, feed URLs and untrusted source labels',()=>{
 const booking={id:'guest-name@example.test',summary:'Private guest',description:'Door code',guestName:'Private guest',url:'private',guests:2,source:'Fake',arrival:{date:'2026-09-20',allDay:true},checkout:{date:'2026-09-22',allDay:true}};
 const result=operationalCalendar([{id,propertyName:'Property',feed_host:'airbnb.com',check_in:'15:00:00',check_out:'10:00:00',bookings:[booking],encrypted_url:'secret'}],'2026-09');
 assert.equal(result.bookings[0].source,'Airbnb');assert.equal(result.bookings[0].guests,2);assert.equal(result.bookings[0].arrival.time,'15:00');
 for(const secret of ['guest-name','Private guest','Door code','encrypted_url','feed_host','airbnb.com','Fake'])assert(!JSON.stringify(result).includes(secret));
 const unknown=operationalCalendar([{id,propertyName:'Property',feed_host:'example.test',bookings:[{...booking,guests:0}]}]);assert.equal(unknown.bookings[0].guests,undefined);assert.equal(unknown.bookings[0].source,undefined);
});
test('standard templates and property applicability preserve task definitions and existing job snapshots',()=>{
 let data=change({properties:[]},{action:'property',name:'Synthetic',phone:'',notes:''});const p=data.properties[0];assert.deepEqual(p.regular,templates.regular);assert.deepEqual(p.deep,templates.deep);
 data=change(data,{action:'applicability',id:p.id,kind:'regular',index:0,applicable:false});assert.deepEqual(data.properties[0].regular,templates.regular);assert.deepEqual(data.properties[0].notApplicable.regular,[0]);
 assert.throws(()=>change(data,{action:'applicability',id:p.id,kind:'regular',index:999,applicable:false}));
 data=change(data,{action:'template',id:p.id,kind:'regular'});assert.deepEqual(data.properties[0].notApplicable.regular,[0]);
});
