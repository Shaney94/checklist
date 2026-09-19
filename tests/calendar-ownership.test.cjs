const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../src/server/handlers/calendar.js');
const {createHandler:dashboard}=require('../src/server/handlers/dashboard.js');
const {createHandler:guides}=require('../src/server/handlers/start-guide.js');
const cleaner={id:'cleaner-one',role:'cleaner',workspaceId:'org:host-workspace',legacyAccess:true};
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(d){this.data=d;return this}});
const request=(body,query={})=>({method:body?'POST':'GET',body,query,headers:{origin:'https://turnli.vercel.app','content-type':'application/json'}});
const propertyStore={load:async owner=>{assert.equal(owner,'user:cleaner-one');return {revision:0,data:{properties:[{id,name:'Own property'}]}}}};
const settings={name:'Own calendar',url:'https://example.com/synthetic.ics',propertyId:id};
const feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic\r\nDTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261002\r\nEND:VEVENT\r\nEND:VCALENDAR';
test('Cleaner with shared tenant membership reads only their personal calendars and properties',async()=>{
 let r=response();await createHandler(async()=>cleaner,()=>({list:async owner=>{assert.equal(owner,'user:cleaner-one');return []}}))(request(undefined,{owner:cleaner.workspaceId}),r);assert.equal(r.code,200);
 r=response();await dashboard(async()=>cleaner,()=>propertyStore)(request(undefined,{workspaceId:cleaner.workspaceId}),r);assert.equal(r.code,200);assert.equal(r.data.data.properties[0].id,id);
});
test('Cleaner can connect an own-workspace property feed; forged workspace and role cannot change ownership',async()=>{
 const r=response();await createHandler(async()=>cleaner,()=>({create:async(owner,input,bookings)=>{
  assert.equal(owner,'user:cleaner-one');assert.equal(input.propertyId,id);assert.equal(bookings.length,1);
  return {id,property_id:id,display_name:input.name,check_in:'15:00',check_out:'10:00',enabled:true};
 }}),async()=>feed,undefined,()=>propertyStore)(request({...settings,action:'connect',owner:cleaner.workspaceId,role:'host'}),r);
 assert.equal(r.code,201);assert.equal(r.data.calendar.propertyId,id);
});
test('new calendar requires explicit owned property before any feed fetch',async()=>{
 for(const [propertyId,status] of [[null,400],[undefined,400],[foreign,404]]){
  const r=response();await createHandler(async()=>cleaner,()=>({create:()=>assert.fail('created')}),()=>assert.fail('feed fetched'),undefined,()=>propertyStore)(request({...settings,action:'connect',propertyId}),r);assert.equal(r.code,status);
 }
});
test('legacy feeds stay unlinked when renamed; explicit foreign links and cross-workspace IDs fail',async()=>{
 const store={get:async(owner,calendarId)=>{assert.equal(owner,'user:cleaner-one');return calendarId===id?{id,property_id:null}:undefined},update:async(owner,calendarId,input)=>{assert.equal(input.propertyId,null);return {id,property_id:null,check_in:'15:00',check_out:'10:00'}}};
 const handler=createHandler(async()=>cleaner,()=>store,undefined,undefined,()=>propertyStore);
 let r=response();await handler(request({action:'update',id,name:'Renamed legacy feed'}),r);assert.equal(r.code,200);assert.equal(r.data.calendar.propertyId,null);
 r=response();await handler(request({action:'update',id,name:'Forged property',propertyId:foreign}),r);assert.equal(r.code,404);
 for(const action of ['update','remove']){r=response();await handler(request({action,id:foreign,name:'Foreign'}),r);assert.equal(r.code,404);}
});
test('Cleaner calendar and property ownership cannot unlock Host guides or allow Host-property writes',async()=>{
 let r=response();await guides(async()=>cleaner,()=>assert.fail('Host workspace read'),()=>assert.fail('Host guide read'))(request(undefined,{id,calendarId:id,propertyId:id,assigned:true}),r);assert.equal(r.code,403);
 r=response();await dashboard(async()=>cleaner,()=>({...propertyStore,save:()=>assert.fail('Host property written')}))(request({action:'property',id:foreign,revision:0,name:'Forged',phone:'',notes:'',workspaceId:cleaner.workspaceId}),r);assert.equal(r.code,404);
});
