const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../src/server/handlers/start-guide.js');
const {createHandler:dashboard}=require('../src/server/handlers/dashboard.js');
const {createStore}=require('../lib/property-guide-store.cjs');
const {validateGuide,guideFields}=require('../lib/property-guide.cjs');
const host={id:'host',role:'host',workspaceId:'workspace-a'};
const property={id:'property-a',name:'Test property',phone:'',notes:'',regular:['Task'],deep:[],faqs:[],checked:{regular:[],deep:[]}};
const guide=Object.fromEntries(Object.keys(guideFields).map(k=>[k,'Synthetic '+k+' instructions']));
const workspace={load:async owner=>{assert.equal(owner,host.workspaceId);return {revision:0,data:{properties:[property]}}}};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}});
const request=(body,query={id:property.id})=>({method:body?'POST':'GET',body,query,headers:{origin:'https://turnli.vercel.app','content-type':'application/json'}});
test('anonymous, cleaner, unsupported and missing-account requests never read sensitive storage',async()=>{
 for(const user of [null,{...host,role:'cleaner'},{...host,role:null},{...host,id:null}])for(const body of [undefined,{id:property.id,revision:0,guide,role:'host',jobId:'forged',assigned:true}]){
  const r=response();await createHandler(async()=>user,()=>assert.fail('workspace accessed'),()=>assert.fail('guide accessed'))(request(body),r);
  assert.equal(r.code,user?403:401);assert(!JSON.stringify(r.data).includes(guide.access));
  assert(r.headers['Cache-Control'].includes('no-store'));assert.equal(r.headers.Vary,'Cookie');
 }
});
test('Host can create and read a guide only within the authenticated workspace/property',async()=>{
 let saved={revision:0,guide:{}};
 const store={load:async(owner,id)=>{assert.equal(owner,host.workspaceId);assert.equal(id,property.id);return saved},save:async(owner,id,revision,data)=>{assert.equal(owner,host.workspaceId);assert.equal(id,property.id);assert.equal(revision,saved.revision);return saved={revision:revision+1,guide:data}}};
 const handler=createHandler(async()=>host,()=>workspace,()=>store);
 let r=response();await handler(request({id:property.id,revision:0,guide,workspaceId:'foreign',owner:'foreign'}),r);assert.equal(r.code,200);assert.equal(r.data.revision,1);
 r=response();await handler(request(undefined,{id:property.id,workspaceId:'foreign'}),r);assert.deepEqual(r.data,{revision:1,guide});
 assert(!('guide' in property));assert.deepEqual(property.regular,['Task']);
});
test('foreign or manipulated property/job IDs never reach the guide store',async()=>{
 const handler=createHandler(async()=>host,()=>workspace,()=>assert.fail('guide accessed'));
 for(const body of [undefined,{id:'property-other',revision:0,guide,jobId:'assigned-job'}]){
  const r=response();await handler(request(body,{id:'property-other',workspaceId:'workspace-b',jobId:'assigned-job'}),r);assert.equal(r.code,404);
 }
 for(const id of ['',null,{},'x'.repeat(101)]){const r=response();await handler(request(undefined,{id}),r);assert.equal(r.code,400);}
});
test('guide validation limits content and rejects unknown keys and incorrect types',()=>{
 assert.deepEqual(validateGuide(guide),guide);
 for(const bad of [null,[],{...guide,access:5},{...guide,other:'x'.repeat(5001)},{...guide,assignedTo:'cleaner'}])assert.throws(()=>validateGuide(bad));
 assert.equal(validateGuide({...guide,access:'  plain text  '}).access,'plain text');
});
test('cross-origin writes and unsupported methods do not authenticate or touch storage',async()=>{
 const handler=createHandler(()=>assert.fail('auth called'));
 const q=request({id:property.id,revision:0,guide});q.headers.origin='https://other.example';let r=response();await handler(q,r);assert.equal(r.code,403);
 r=response();await handler({...q,method:'DELETE'},r);assert.equal(r.code,405);
});
test('stale guide revision is an explicit conflict, and storage failures do not claim success or leak text',async()=>{
 let r=response();await createHandler(async()=>host,()=>workspace,()=>({save:async()=>undefined}))(request({id:property.id,revision:0,guide}),r);assert.equal(r.code,409);
 r=response();await createHandler(async()=>host,()=>workspace,()=>({save:async()=>{throw Error(guide.access)}}))(request({id:property.id,revision:0,guide}),r);assert.equal(r.code,503);assert(!JSON.stringify(r.data).includes(guide.access));
});
test('guide SQL scopes reads and writes to both IDs, checks property ownership and compares revisions',async()=>{
 const calls=[];const db=async(strings,...values)=>{calls.push({sql:strings.join('?'),values});return []};const store=createStore(db);
 assert.deepEqual(await store.load('workspace-a','property-a'),{revision:0,guide:{}});
 assert.equal(await store.save('workspace-a','property-a',7,guide),undefined);
 assert.match(calls[0].sql,/WHERE owner_id=\? AND property_id=\?/);assert.deepEqual(calls[0].values,['workspace-a','property-a']);
 assert.match(calls[1].sql,/FROM turnli_dashboard WHERE owner_id=\? AND data @> \?::jsonb/);
 assert.match(calls[2].sql,/owner_id=\? AND property_id=\? AND revision=\? AND EXISTS/);
 assert(calls[2].values.includes(7));assert(calls[2].values.includes(JSON.stringify({properties:[{id:'property-a'}]})));
});
test('shared checklist API cannot read or write the separate guide store',async()=>{
 const saved={revision:0,data:{properties:[structuredClone(property)]}};
 const store={load:async()=>saved,save:async(owner,revision,data)=>({revision:1,data})};
 for(const role of ['host','cleaner']){
  const handler=dashboard(async()=>({...host,role}),()=>store);
  let r=response();await handler(request(),r);assert(!JSON.stringify(r.data).includes(guide.access));
  r=response();await handler(request({action:'property',id:property.id,name:property.name,phone:'',notes:'',revision:0,guide}),r);
  assert.equal(r.code,200);assert(!JSON.stringify(r.data).includes(guide.access));assert(!('guide' in r.data.data.properties[0]));
 }
});
