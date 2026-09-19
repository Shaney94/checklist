const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../src/server/handlers/cleaning-jobs.js');
const {createHandler:guideHandler}=require('../src/server/handlers/start-guide.js');
const {eligibleCleaner,date}=require('../lib/cleaning-jobs.cjs');
const {createStore}=require('../lib/cleaning-job-store.cjs');
const host={id:'host',role:'host',workspaceId:'workspace-a'},cleaner={id:'cleaner',role:'cleaner',workspaceId:'workspace-b'};
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',code='a'.repeat(43);
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}});
const request=(body,query={})=>({method:body?'POST':'GET',body,query,headers:{origin:'https://turnli.vercel.app','content-type':'application/json'}});
async function call(user,store,body,query,eligible=async()=>true){const r=response();await createHandler(async()=>user,()=>store,eligible)(request(body,query),r);return r;}
test('auth, supported roles, same-origin writes and methods are required before data access',async()=>{
 for(const user of [null,{...host,role:null},{...host,id:null}]){const r=response();await createHandler(async()=>user,()=>assert.fail('store accessed'))(request(),r);assert.equal(r.code,user?403:401);assert.match(r.headers['Cache-Control'],/no-store/);}
 for(const q of [{...request({}),headers:{origin:'https://attacker.example'}},{...request(),method:'DELETE'}]){const r=response();await createHandler(()=>assert.fail('authenticated'))(q,r);assert([403,405].includes(r.code));}
});
test('Cleaner cannot create jobs, assign themselves or generate codes for another identity',async()=>{
 for(const action of ['create','assign','unassign','cancel']){
  const r=response();await createHandler(async()=>cleaner,()=>assert.fail('unauthorized action accessed store'))(request({action,id,role:'host',workspaceId:host.workspaceId}),r);assert.equal(r.code,403);
 }
 assert.equal((await call(host,{}, {action:'code'})).code,403);
 const r=await call(cleaner,{rotateCode:async user=>{assert.equal(user,cleaner.id);return code}},{action:'code',userId:'victim',role:'host'});assert.deepEqual(r.data,{code});
});
test('Host cannot use Cleaner detail endpoints even when storage is unavailable',async()=>{
 const r=response();await createHandler(async()=>host,()=>assert.fail('store accessed'))(request(undefined,{id}),r);assert.equal(r.code,403);
});
test('job creation uses authenticated workspace and validates dates, kind and property ownership',async()=>{
 const store={create:async(...args)=>{assert.deepEqual(args,[host.workspaceId,id,'2026-09-21','regular']);return undefined}};
 assert.equal((await call(host,store,{action:'create',propertyId:id,date:'2026-09-21',kind:'regular',owner:'other'})).code,404);
 for(const bad of ['2026-02-30','2026-13-01','invalid','1999-01-01']){assert(!date(bad));assert.equal((await call(host,{}, {action:'create',propertyId:id,date:bad,kind:'regular'})).code,400);}
});
test('foreign, cancelled and stale jobs never look up Cleaner codes',async()=>{
 for(const [job,status] of [[undefined,404],[{state:'cancelled',revision:0},409],[{state:'scheduled',revision:1},409]]){
  const r=await call(host,{hostJob:async(owner,jobId)=>{assert.equal(owner,host.workspaceId);assert.equal(jobId,id);return job},cleaner:()=>assert.fail('code lookup')},{action:'assign',id,revision:0,code});assert.equal(r.code,status);
 }
});
test('assignment validates code and live provider eligibility, scopes writes, and never returns the code',async()=>{
 const store={hostJob:async()=>({state:'scheduled',revision:3}),cleaner:async c=>{assert.equal(c,code);return cleaner.id},assign:async(...args)=>{assert.deepEqual(args,[host.workspaceId,id,3,cleaner.id,code]);return {id}}};
 const r=await call(host,store,{action:'assign',id,revision:3,code,cleanerId:'forged',workspaceId:'forged'},undefined,async user=>{assert.equal(user,cleaner.id);return true});assert.equal(r.code,200);assert(!JSON.stringify(r.data).includes(code));
 for(const invalidCode of ['wrong',code]){const r=await call(host,store,{action:'assign',id,revision:3,code:invalidCode},undefined,async()=>false);assert.equal(r.code,400);assert.equal(r.data.error,'Assignment code is invalid or the Cleaner is unavailable.');}
 assert.equal((await call(host,store,{action:'assign',id,revision:3,code},undefined,async()=>{throw Error('private identity data')})).code,503);
});
test('provider eligibility rejects disabled/unverified/Host/unsupported identities and handles service errors',async()=>{
 const user={userId:cleaner.id,email:'synthetic@example.invalid',verifiedEmail:true,status:'enabled',roleNames:[]};
 const sdk=data=>({management:{user:{loadByUserId:async id=>{assert.equal(id,cleaner.id);return {ok:true,data}}}}});
 assert(await eligibleCleaner(cleaner.id,sdk(user)));
 for(const changed of [{status:'disabled'},{email:''},{verifiedEmail:false},{userId:'different'},{roleNames:['turnli-host']},{roleNames:['turnli-future']}])assert.equal(await eligibleCleaner(cleaner.id,sdk({...user,...changed})),false);
 await assert.rejects(eligibleCleaner(cleaner.id,{management:{user:{loadByUserId:async()=>({ok:false,code:503})}}}));
});
test('Cleaner reads and checks only assignments to their authenticated identity',async()=>{
 const store={assigned:async(user,job)=>{assert.equal(user,cleaner.id);assert.equal(job,id);return undefined},check:async(...args)=>{assert.deepEqual(args,[cleaner.id,id,2,0,true]);return undefined}};
 assert.equal((await call(cleaner,store,undefined,{id,cleanerId:'another',owner:host.workspaceId})).code,404);
 assert.equal((await call(cleaner,store,{action:'check',id,revision:2,index:0,checked:true,cleanerId:'another'})).code,409);
 assert.equal((await call(host,{}, {action:'check',id,revision:2,index:0,checked:true})).code,403);
});
test('assigned guides use only verified Cleaner ID and job ID; writes remain Host-only',async()=>{
 for(const result of [undefined,{revision:1,guide:{access:'Synthetic guide'}}]){
  const r=response();await guideHandler(async()=>cleaner,()=>assert.fail('caller workspace loaded'),()=>assert.fail('unscoped guide read'),()=>({guide:async(user,job)=>{assert.equal(user,cleaner.id);assert.equal(job,id);return result}}))(request(undefined,{jobId:id,id:'foreign',workspaceId:'foreign'}),r);
  assert.equal(r.code,result?200:404);if(result)assert.deepEqual(r.data,result);
 }
 const r=response();await guideHandler(async()=>cleaner,()=>assert.fail('workspace accessed'))(request({id,jobId:id,revision:0,guide:{}}),r);assert.equal(r.code,403);
});
test('assignment codes are random, hashed at rest and rotated only for the signed-in identity',async()=>{
 const calls=[];const store=createStore(async(strings,...values)=>{calls.push({sql:strings.join('?'),values});return []});
 const a=await store.rotateCode(cleaner.id),b=await store.rotateCode(cleaner.id);assert.match(a,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a,b);
 assert(calls.every(c=>c.values[0]===cleaner.id&&!c.values.includes(a)&&!c.values.includes(b)));assert.match(calls[0].sql,/ON CONFLICT\(user_id\) DO UPDATE/);
});
