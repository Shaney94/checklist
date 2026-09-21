const {test}=require('node:test'),assert=require('node:assert/strict');
const {accountUser,currentUser,createHandler:accountHandler}=require('../lib/account.cjs');
const {roleState,resolveRole,workspaceRoute,can}=require('../lib/authorization.cjs');
const {createHandler:assignments}=require('../src/server/handlers/property-assignments.js');
const {provisionInvitedCleaner}=require('../lib/invitation-onboarding.cjs');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const identity={userId:'synthetic-roleless',email:'roleless@example.test',verifiedEmail:true,roleNames:[]};
const strictUser=()=>accountUser(identity);
function res(){return {headers:{},getHeader(k){return this.headers[k]},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this},end(data){this.data=data;return this}};}
const req=(body,query={})=>({method:body?'POST':'GET',query,body,headers:{origin:'https://turnli.io','content-type':'application/json',cookie:'__Host-turnly-session=old-session; __Host-turnly-refresh=refresh'}});
test('explicit state distinguishes roleless and unsupported and denies implicit Cleaner access',()=>{
 assert.equal(roleState(identity),'roleless');assert.equal(resolveRole(identity),null);
 for(const roles of [['turnli-unknown'],['turnli-cleaner','turnli-host'],[null],'bad'])assert.equal(roleState({...identity,roleNames:roles}),'unsupported');
 assert.equal(roleState({...identity,roleNames:['turnli-host']}),'host');assert.equal(roleState({...identity,roleNames:['turnli-cleaner']}),'cleaner');
 const tenant={...identity,roleNames:['turnli-host'],userTenants:[{tenantId:'own',roleNames:[]},{tenantId:'other',roleNames:['turnli-cleaner']}]};
 assert.equal(roleState(tenant,'own'),'roleless');assert.equal(roleState(tenant,'other'),'cleaner');
 assert.equal(can(strictUser(),'cleaner.view'),false);
 assert.deepEqual(workspaceRoute(strictUser(),'/app'),{status:303,location:'/app/setup'});
 assert.equal(workspaceRoute(strictUser(),'/app/setup').status,200);
 assert.equal(workspaceRoute({...strictUser(),authorizationState:'unsupported'},'/app/setup').status,403);
});
test('restricted onboarding exposes only pending invitations; no permissions are inferred',async()=>{
 const user=strictUser(),r=res();
 await assignments(async()=>user,()=>({onboarding:async u=>{assert.deepEqual(u,user);return [{id,propertyName:'Synthetic home'}]}}))(req(undefined,{action:'onboarding'}),r);
 assert.deepEqual(r.data,{invitations:[{id,propertyName:'Synthetic home'}]});
 for(const query of [{},{action:'calendar',id:'all'},{action:'guide',id}]){
  const denied=res();await assignments(async()=>user,()=>assert.fail('operational store accessed'))(req(undefined,query),denied);assert.equal(denied.code,403);
 }
 for(const state of ['host','unsupported',undefined]){
  const denied=res();await assignments(async()=>({...user,authorizationState:state}),()=>assert.fail())(req(undefined,{action:'onboarding'}),denied);assert.equal(denied.code,403);
 }
});
test('roleless acceptance provisions only after valid invitation, confirms provider role and rechecks SQL acceptance',async()=>{
 for(const scenario of ['valid','wrong-email','expired','revoked','provider-failure','revoked-during-setup']){
  const data=structuredClone(identity),user=strictUser();let grants=0,accepts=0;
  const sdk={management:{user:{loadByUserId:async()=>({ok:true,data}),addRoles:async()=>{grants++;if(scenario==='provider-failure')return {ok:false};data.roleNames=['turnli-cleaner'];return {ok:true}}}}};
  const store={pending:async()=>['wrong-email','expired','revoked'].includes(scenario)?null:{id},accept:async()=>{accepts++;assert.equal(roleState(data),'cleaner');return scenario==='revoked-during-setup'?null:{id}}};
  const r=res();await assignments(async()=>user,()=>store,()=>assert.fail(),u=>provisionInvitedCleaner(u,sdk))(req({action:'accept',id,role:'host',email:'forged@example.test'}),r);
  assert.equal(r.code,scenario==='valid'?200:scenario==='provider-failure'?503:409);
  if(['wrong-email','expired','revoked'].includes(scenario)){assert.equal(grants,0);assert.equal(accepts,0);}
  if(scenario==='provider-failure'){assert.equal(accepts,0);assert.equal(r.data.code,'setup-incomplete');}
 }
});
test('roleless auth and recovery retain setup state; sessions re-read provider roles instead of old claims',async()=>{
 const result={ok:true,data:{sessionJwt:'session',refreshJwt:'refresh'}},data=structuredClone(identity);
 const sdk={me:async()=>({ok:true,data}),validateSession:async()=>({token:{roles:['turnli-cleaner']}}),refreshSession:async()=>({jwt:'session',refreshJwt:'refresh'}),magicLink:{verify:async()=>result},password:{signIn:async()=>result,update:async()=>({ok:true})},otp:{verify:{email:async()=>result}}};
 for(const action of ['password-login','verify-code','set-password','invite-login']){
  const r=res();await accountHandler(()=>sdk)(req({action,email:data.email,password:'SyntheticPassword123!',code:'123456',token:'synthetic-link'}),r);assert.equal(r.code,200);assert.equal(r.data.user.authorizationState,'roleless');assert.equal(r.data.user.role,null);
 }
 for(const expired of [false,true]){
  sdk.validateSession=async()=>{if(expired)throw Error('expired');return {token:{roles:['turnli-host']}}};
  const u=await currentUser(req(),res(),sdk);assert.equal(u.authorizationState,'roleless');assert.equal(u.role,null);assert.equal(can(u,'cleaner.view'),false);
  data.roleNames=['turnli-cleaner'];assert.equal((await currentUser(req(),res(),sdk)).authorizationState,'cleaner');data.roleNames=[];
 }
});
test('post-migration roleless identity is denied all operational handlers before persistence',async()=>{
 for(const name of ['dashboard','calendar','start-guide','cleaning-jobs','completion','job-issues','bootstrap']){
  const {createHandler}=require('../src/server/handlers/'+name+'.js');const r=res();await createHandler(async()=>strictUser(),()=>assert.fail(name+' accessed persistence'))(req(),r);assert.equal(r.code,403,name);
 }
});
