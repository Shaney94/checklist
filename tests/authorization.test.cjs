const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolveRole,can,home,workspaceRoute,managedWorkspace}=require('../lib/authorization.cjs');
const {accountUser}=require('../lib/account.cjs');
const {createHandler:dashboard}=require('../src/server/handlers/dashboard.js');
const {createHandler:calendar}=require('../src/server/handlers/calendar.js');
const {createHandler:bootstrap}=require('../src/server/handlers/bootstrap.js');
const user=(role='cleaner')=>({id:'one',workspaceId:'user:one',role});
const response=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this},end(data){this.data=data;return this}});
const request=(body,method='POST')=>({method,body,query:{},headers:{origin:'https://turnli.vercel.app','content-type':'application/json'}});
test('roleless accounts are denied; explicit roles use only their authenticated scope',()=>{
 assert.equal(resolveRole({}),null);
 assert.equal(resolveRole({roleNames:['unrelated-provider-role']}),null);
 assert.equal(resolveRole({roleNames:['turnli-host']}),'host');
 assert.equal(resolveRole({role:'host',customAttributes:{role:'host'}}),null);
 const provider={roleNames:['turnli-host'],userTenants:[{tenantId:'other',roleNames:['turnli-host']},{tenantId:'mine',roleNames:[]}]};
 assert.equal(resolveRole(provider,'mine'),null);
 assert.equal(resolveRole({...provider,userTenants:[{tenantId:'mine',roleNames:['turnli-host']}]},'mine'),'host');
 assert.equal(accountUser({userId:'new',email:'new@example.com',roleNames:['turnli-host']}).workspaceId,'user:new');
});
test('unsupported, conflicting and malformed Turnli roles fail closed',()=>{
 for(const roleNames of [['turnli-admin'],['turnli-host','turnli-cleaner'],'turnli-host',[null]])assert.equal(resolveRole({roleNames}),null);
 for(const role of [undefined,null,'admin','__proto__'])assert.equal(can(user(role),'host.view'),false);
 assert.equal(can({...user('host'),workspaceId:null},'host.view'),false);
});
test('routing separates host and cleaner experiences and rejects invented pages',()=>{
 assert.equal(home(user()),'/app');assert.equal(home(user('host')),'/app/host');
 assert.deepEqual(workspaceRoute(user('host'),'/app'),{status:303,location:'/app/host'});
 assert.equal(workspaceRoute(user(),'/app').status,200);
 assert.equal(workspaceRoute(user(),'/app/host/properties').status,403);
 assert.equal(workspaceRoute(user('host'),'/app/host/cleaning-jobs').status,200);
 assert.equal(workspaceRoute(user('host'),'/app/host/payments').status,404);
 assert.equal(workspaceRoute(user(null),'/app').status,403);
});
test('both roles manage calendars/properties, but Cleaner management uses only their own workspace',()=>{
 for(const permission of ['workspace.read','workspace.setup','calendar.read','calendar.manage'])for(const role of ['host','cleaner'])assert(can(user(role),permission));
 assert(!can(user(),'jobs.manage'));assert(can(user(),'jobs.assigned'));assert(can(user(),'guide.assigned'));assert(!can(user(),'guide.read'));
 assert.equal(managedWorkspace({...user(),workspaceId:'org:host'}),'user:one');
 assert.equal(managedWorkspace({...user('host'),workspaceId:'org:host'}),'org:host');
 assert.equal(managedWorkspace({...user(),id:null}),null);
});
test('unknown roles are rejected before any workspace, calendar or private-content access',async()=>{
 for(const handler of [dashboard,calendar,bootstrap]){
  const r=response();await handler(async()=>user(null),()=>assert.fail('data accessed'))(request(undefined,'GET'),r);assert.equal(r.code,403);
 }
});
test('host cannot mutate cleaner progress by forging a role or workspace in the request',async()=>{
 for(const action of ['check','reset','legacy-progress']){
  const r=response();await dashboard(async()=>user('host'),()=>assert.fail('data accessed'))(request({action,role:'cleaner',workspaceId:'other',revision:0}),r);assert.equal(r.code,403);
 }
});
test('property mutations are restricted to properties loaded from the authenticated workspace',async()=>{
 for(const role of ['cleaner','host'])for(const action of ['property','content']){
  const r=response();await dashboard(async()=>user(role),()=>({load:async owner=>{assert.equal(owner,'user:one');return {revision:0,data:{properties:[{id:'own'}]}}},save:()=>assert.fail('foreign property saved')}))(request({action,id:'foreign',owner:'user:other',workspaceId:'user:other',revision:0}),r);
  assert.equal(r.code,404);
 }
});
test('host bootstrap never loads original cleaner content; unsupported state is explicit',async()=>{
 const r=response();await bootstrap(async()=>({...user('host'),legacyAccess:true}),()=>assert.fail('cleaner content loaded'))(request(undefined,'GET'),r);assert.equal(r.code,200);assert.equal(r.data.content,null);
});
