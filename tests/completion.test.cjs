const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const {validatePhoto,MAX_UPLOAD}=require('../lib/completion.cjs');
const {createHandler}=require('../src/server/handlers/completion.js');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',photoId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cleaner={id:'cleaner',role:'cleaner',workspaceId:'user:cleaner'},host={id:'host',role:'host',workspaceId:'workspace-host'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(data){this.data=data;return this},end(data){this.data=data;return this}});
const request=(body,query={jobId:id})=>({method:body?'POST':'GET',body,query,headers:{origin:'https://turnli.vercel.app','content-type':'application/json'}});
const job={id,state:'scheduled',revision:2,tasks:['Task'],checked:[0],photos:[]};
async function call(user,store,body,query,validate){const r=response();await createHandler(async()=>user,()=>store,validate)(request(body,query),r);return r;}
test('completion requires authenticated supported role, origin and methods before storage',async()=>{
 for(const user of [null,{...cleaner,role:null},{...cleaner,id:null}]){
  const r=response();await createHandler(async()=>user,()=>assert.fail('storage accessed'))(request(),r);assert.equal(r.code,user?403:401);assert.match(r.headers['Cache-Control'],/no-store/);
 }
 for(const req of [{...request({}),headers:{origin:'https://other.example'}},{...request(),method:'DELETE'}]){const r=response();await createHandler(()=>assert.fail('auth reached'))(req,r);assert([403,405].includes(r.code));}
});
test('Host cannot upload or submit, and Cleaner cannot review, regardless of forged role',async()=>{
 for(const [user,actions] of [[host,['upload','remove','submit']],[cleaner,['approve','issue']]])for(const action of actions){const r=response();await createHandler(async()=>user,()=>assert.fail('storage accessed'))(request({action,jobId:id,role:'host'}),r);assert.equal(r.code,403);}
});
test('view, photo reads and submission pass only authenticated identity and verified job IDs',async()=>{
 const store={view:async(user,jobId,isHost)=>{assert.deepEqual(user,cleaner);assert.equal(jobId,id);assert.equal(isHost,false);return job},submit:async(...args)=>{assert.deepEqual(args,[cleaner.id,id,2]);return {state:'awaiting_review'}}};
 const r=await call(cleaner,store,{action:'submit',jobId:id,revision:2,workspaceId:host.workspaceId,assigned:true,checked:[0],photos:[photoId]});assert.equal(r.code,200);
 const denied=await call(cleaner,{view:async()=>undefined},{action:'upload',jobId:id,revision:2},undefined,()=>assert.fail('image processed'));assert.equal(denied.code,404);
 const photo=await call(host,{photo:async(user,jobId,file,isHost)=>{assert.equal(user.workspaceId,host.workspaceId);assert.equal(jobId,id);assert.equal(file,photoId);assert.equal(isHost,true);return {data:Buffer.from('synthetic').toString('base64')}}},undefined,{jobId:id,photoId,workspaceId:'foreign'});
 assert.equal(photo.code,200);assert.equal(photo.headers['Content-Type'],'image/jpeg');assert.equal(photo.headers['X-Content-Type-Options'],'nosniff');assert.match(photo.headers['Cache-Control'],/no-store/);
 assert.equal((await call(cleaner,{photo:async()=>undefined},undefined,{jobId:id,photoId})).code,404);
});
test('submitted evidence is immutable and stale draft writes conflict',async()=>{
 for(const state of ['awaiting_review','approved','issue_reported'])for(const action of ['upload','remove','submit']){
  const r=await call(cleaner,{view:async()=>({...job,state})},{action,jobId:id,revision:2,photoId},undefined,()=>assert.fail('image processed'));assert.equal(r.code,409);
 }
 assert.equal((await call(cleaner,{view:async()=>job},{action:'submit',jobId:id,revision:1})).code,409);
});
test('upload limits are enforced before storage and client storage references are never accepted',async()=>{
 let r=await call(cleaner,{view:async()=>({...job,photos:Array(6).fill({id:photoId})})},{action:'upload',jobId:id,revision:2},undefined,()=>assert.fail('image processed'));assert.equal(r.code,400);
 r=await call(cleaner,{view:async()=>job},{action:'upload',jobId:id,revision:2,url:'https://attacker.example/image.jpg',storageKey:'foreign'});assert.equal(r.code,400);
 const normalized={bytes:Buffer.from('safe')};r=await call(cleaner,{view:async()=>job,add:async(...args)=>{assert.deepEqual(args,[cleaner.id,id,2,normalized]);return {revision:3}}},{action:'upload',jobId:id,revision:2,storageKey:'foreign'},undefined,async()=>normalized);assert.equal(r.code,200);
});
test('Host review requires a pending job and a bounded issue description',async()=>{
 const pending={...job,state:'awaiting_review'},store={view:async()=>pending,review:async(user,jobId,rev,state,note)=>{assert.deepEqual(user,host);assert.equal(jobId,id);assert.equal(rev,2);assert.equal(state,'issue_reported');assert.equal(note,'Missed task');return {state}}};
 for(const note of ['', ' ', 'x'.repeat(2001)])assert.equal((await call(host,store,{action:'issue',jobId:id,revision:2,note})).code,400);
 assert.equal((await call(host,store,{action:'issue',jobId:id,revision:2,note:' Missed task '})).code,200);
 assert.equal((await call(host,{view:async()=>({...pending,state:'approved'})},{action:'issue',jobId:id,revision:2,note:'Overwrite'})).code,409);
});
test('JPEG/PNG/WebP are decoded, bounded, normalized and stripped of metadata',async()=>{
 for(const [format,type] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
  const original=await sharp({create:{width:80,height:60,channels:3,background:'red'}}).withMetadata({exif:{IFD0:{Copyright:'Synthetic private metadata'}}})[format]().toBuffer();
  const photo=await validatePhoto({type,data:original.toString('base64')});
  const meta=await sharp(photo.bytes).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.equal(photo.width,80);assert.equal(photo.height,60);assert.equal(photo.size,photo.bytes.length);
  await assert.rejects(validatePhoto({type:'image/gif',data:original.toString('base64')}));
 }
 const large=await sharp({create:{width:2000,height:1000,channels:3,background:'blue'}}).png().toBuffer();assert.equal((await validatePhoto({type:'image/png',data:large.toString('base64')})).width,1600);
});
test('corrupt, mismatched, oversized, excessive-pixel and non-image uploads are rejected',async()=>{
 const png=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer();
 for(const body of [{type:'image/jpeg',data:png.toString('base64')},{type:'image/png',data:png.subarray(0,25).toString('base64')},{type:'image/png',data:'not base64'},{type:'image/jpeg',data:Buffer.from('<svg onload="alert(1)"/>').toString('base64')},{type:'image/png',data:'A'.repeat(4*Math.ceil(MAX_UPLOAD/3)+4)}])await assert.rejects(validatePhoto(body));
 const huge=await sharp({create:{width:4001,height:4000,channels:3,background:'white'}}).png().toBuffer();await assert.rejects(validatePhoto({type:'image/png',data:huge.toString('base64')}));
});
