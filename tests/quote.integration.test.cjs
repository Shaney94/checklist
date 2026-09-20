const {enabled}=require('./fixtures/integration-db.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createHandler}=require('../src/server/handlers/quote-save.js');
const {createStore}=require('../lib/dashboard-store.cjs');
const {database}=require('../lib/calendar-store.cjs');
const {change}=require('../src/server/handlers/dashboard.js');
const details={location:'Synthetic location',bedrooms:2,beds:2,bathrooms:1,size:52,sizeUnit:'m2',kind:'both'};
const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
test('PostgreSQL quote persists in the existing property, deduplicates concurrent saves and isolates workspace/account reads',{skip:!enabled},async()=>{
 const db=database(),store=createStore(db),user={id:'quote:'+randomUUID(),workspaceId:'quote-workspace:'+randomUUID(),role:'host'},id=randomUUID();
 const handler=createHandler(async()=>user,()=>store),req={method:'POST',headers:{origin:'https://turnli.io','content-type':'application/json'},body:{id,details}};
 try{
  const responses=await Promise.all([1,2,3].map(async()=>{const r=res();await handler(req,r);return r;}));
  assert(responses.every(r=>[200,201].includes(r.code)));assert.equal(new Set(responses.map(r=>r.data.propertyId)).size,1);
  const saved=await createStore(db).load(user.workspaceId);assert.equal(saved.data.properties.length,1);assert.equal(saved.data.properties[0].regular.length,38);
  const p=saved.data.properties[0];const updated=change(saved.data,{action:'property',id:p.id,name:'Updated name',phone:'',notes:''});await store.save(user.workspaceId,saved.revision,updated);
  const read=res();await createHandler(async()=>user,()=>createStore(db))({method:'GET',query:{id}},read);assert.equal(read.code,200);assert.equal(read.data.quote.prices[1].price,130);
  for(const other of [{...user,workspaceId:'other'},{...user,id:'other'},{...user,role:'cleaner'}]){const r=res();await createHandler(async()=>other,()=>store)({method:'GET',query:{id}},r);assert.equal(r.code,404);}
 }finally{await db`DELETE FROM turnli_dashboard WHERE owner_id=${user.workspaceId}`;}
});
