const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../src/server/handlers/job-issues.js');
const {validateIssue}=require('../lib/job-issues.cjs');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',issueId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cleaner={id:'cleaner',role:'cleaner',workspaceId:'user:cleaner'},host={id:'host',role:'host',workspaceId:'host-workspace'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(data){this.data=data;return this},end(data){this.data=data;return this}});
const request=(body,query={jobId:id})=>({method:body?'POST':'GET',body,query,headers:{origin:'https://turnli.io','content-type':'application/json'}});
const body={jobId:id,id:issueId,revision:2,category:'maintenance',description:' Synthetic issue '};
async function call(user,store,b,query,validate){const res=response();await createHandler(async()=>user,()=>store,validate)(request(b,query),res);return res;}
test('issues require an authenticated role; Hosts cannot submit and client role claims cannot authorize',async()=>{
 for(const user of [null,{...cleaner,role:null},{...cleaner,id:null}])assert.equal((await call(user,()=>assert.fail('storage used'))).code,user?403:401);
 assert.equal((await call(host,()=>assert.fail('storage used'),{...body,role:'cleaner'})).code,403);
 const res=response();await createHandler(()=>assert.fail('auth used'))({...request(body),headers:{origin:'https://unrelated.example','content-type':'application/json'}},res);assert.equal(res.code,403);
});
test('issue validation bounds category/description and rejects inherited object keys',()=>{
 assert.deepEqual(validateIssue(body),{category:'maintenance',description:'Synthetic issue'});
 for(const b of [{...body,category:'__proto__'},{...body,category:'constructor'},{...body,description:' '},{...body,description:'x'.repeat(2001)}])assert.throws(()=>validateIssue(b));
});
test('only the authenticated identity and validated image bytes reach storage',async()=>{
 const normalized={bytes:Buffer.from('normalized')};let validated=false;
 const res=await call(cleaner,{job:async(user,jobId,asHost)=>{assert.deepEqual(user,cleaner);assert.equal(jobId,id);assert.equal(asHost,false);return {state:'scheduled',revision:2}},create:async(...args)=>{assert.deepEqual(args,[cleaner.id,id,2,issueId,{category:'maintenance',description:'Synthetic issue'},normalized]);return {id:issueId}}},{...body,owner:'foreign',cleanerId:'other',role:'host',photo:{type:'image/png',data:'synthetic'},storageKey:'foreign'},undefined,async photo=>{validated=true;assert.equal(photo.data,'synthetic');return normalized});
 assert.equal(res.code,201);assert(validated);assert.match(res.headers['Cache-Control'],/no-store/);
 assert.equal((await call(cleaner,{job:async()=>undefined},body,undefined,()=>assert.fail('image processed'))).code,404);
});
test('submitted/cancelled jobs and stale revisions reject writes before photo processing',async()=>{
 for(const state of ['cancelled','awaiting_review','approved','issue_reported'])assert.equal((await call(cleaner,{job:async()=>({state,revision:2})},{...body,photo:{}},undefined,()=>assert.fail('image processed'))).code,409);
 assert.equal((await call(cleaner,{job:async()=>({state:'scheduled',revision:3})},body)).code,409);
 assert.equal((await call(cleaner,{job:async()=>({state:'scheduled',revision:2})},{...body,photo:{url:'https://other.example/photo',storageKey:'forged'}})).code,400);
});
test('private photos use server authorization and no-store; issue responses omit contact/ownership fields',async()=>{
 const res=await call(host,{photo:async(user,jobId,file,asHost)=>{assert.deepEqual(user,host);assert.equal(jobId,id);assert.equal(file,issueId);assert(asHost);return {data:Buffer.from('synthetic').toString('base64')}}},undefined,{jobId:id,photoId:issueId,owner:'foreign'});
 assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'image/jpeg');assert.match(res.headers['Cache-Control'],/no-store/);assert.equal(res.headers['X-Content-Type-Options'],'nosniff');
 assert.equal((await call(cleaner,{photo:async()=>undefined},undefined,{jobId:id,photoId:issueId})).code,404);
 const failed=await call(cleaner,{job:async()=>{throw Error('private database details')}});assert.equal(failed.code,503);assert(!JSON.stringify(failed.data).includes('private database'));
});
