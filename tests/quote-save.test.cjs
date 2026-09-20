const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../src/server/handlers/quote-save.js');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const details={location:'Synthetic Glasgow',bedrooms:2,beds:2,bathrooms:1,size:52,sizeUnit:'m2',kind:'both'};
const request=(body={id,details})=>({method:'POST',headers:{origin:'https://turnli.io','content-type':'application/json'},body});
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};}
test('saving requires a supported authenticated account; rejects foreign origins and client prices',async()=>{
 for(const [user,req,status] of [[null,request(),401],[{id:'u',workspaceId:'w',role:null},request(),403],[{id:'u',workspaceId:'w',role:'host'},request({id,details:{...details,price:1}}),400],[{id:'u',workspaceId:'w',role:'host'},request({id,details,workspaceId:'other'}),400]]){
  const r=response();await createHandler(async()=>user,()=>assert.fail('no store access'))(req,r);assert.equal(r.code,status);
 }
 const r=response();await createHandler(()=>assert.fail('no authentication'))({...request(),headers:{origin:'https://evil.example'}},r);assert.equal(r.code,403);
});
test('save recalculates, creates standard property once and scopes Host/Cleaner ownership',async()=>{
 for(const role of ['host','cleaner']){
  const user={id:'account',workspaceId:'host-tenant',role},owner=role==='host'?'host-tenant':'user:account';
  let state={revision:0,data:{properties:[]}},writes=0;
  const store={load:async key=>{assert.equal(key,owner);return structuredClone(state);},save:async(key,revision,data)=>{assert.equal(key,owner);assert.equal(revision,state.revision);state={revision:revision+1,data};writes++;return state;}};
  const handler=createHandler(async()=>user,()=>store),r=response();await handler(request(),r);assert.equal(r.code,201);assert.equal(r.data.quote.prices[0].price,60);
  const property=state.data.properties[0];assert.equal(property.regular.length,38);assert.equal(property.deep.length,109);assert.deepEqual(property.checked,{regular:[],deep:[]});
  const repeat=response();await handler(request(),repeat);assert.equal(writes,1);assert.equal(repeat.data.propertyId,r.data.propertyId);
  const read=response();await handler({method:'GET',query:{id}},read);assert.equal(read.data.propertyId,r.data.propertyId);
  const foreign=response();await createHandler(async()=>({...user,id:'other',workspaceId:'other'}),()=>({load:async()=>({data:{properties:[]}})}))({method:'GET',query:{id}},foreign);assert.equal(foreign.code,404);
 }
});
test('conflicts retry against fresh workspace data and never overwrite concurrent properties',async()=>{
 let n=0,revision=0;const sentinel={id:'existing',name:'Keep me'},store={load:async()=>({revision,data:{properties:[sentinel]}}),save:async(owner,expected,data)=>{n++;if(n===1){revision++;return;}assert.equal(expected,1);assert.deepEqual(data.properties[0],sentinel);return {revision:2};}};
 const r=response();await createHandler(async()=>({id:'a',workspaceId:'w',role:'host'}),()=>store)(request(),r);assert.equal(r.code,201);assert.equal(n,2);
});
