const {test}=require('node:test'),assert=require('node:assert/strict');
const {provisionInvitedCleaner}=require('../lib/invitation-onboarding.cjs');
const {accountUser,createHandler:accountHandler,OWNER_EMAIL}=require('../lib/account.cjs');
const {createHandler}=require('../src/server/handlers/property-assignments.js');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(extra={}){
 const data={userId:'cleaner',email:'cleaner@example.test',verifiedEmail:true,roleNames:[],...extra},calls=[];
 const sdk={management:{user:{loadByUserId:async()=>({ok:true,data}),addRoles:async(uid,roles)=>{calls.push(['project',uid]);data.roleNames=roles;return {ok:true}},addTenantRoles:async(uid,tenant,roles)=>{calls.push(['tenant',uid,tenant]);data.userTenants.find(t=>t.tenantId===tenant).roleNames=roles;return {ok:true}}}}};
 return {data,calls,sdk,user:accountUser(data)};
}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},getHeader(k){return this.headers[k]},status(code){this.code=code;return this},json(data){this.data=data;return this}};}
const request=body=>({method:'POST',body,headers:{origin:'https://turnli.io','content-type':'application/json'}});
test('verified invited Cleaner provisioning is explicit and idempotent',async()=>{
 const f=fixture();await provisionInvitedCleaner(f.user,f.sdk);await provisionInvitedCleaner(f.user,f.sdk);assert.deepEqual(f.calls,[['project','cleaner']]);assert.deepEqual(f.data.roleNames,['turnli-cleaner']);
});
test('Host, conflicting, unsupported, malformed and unverified identities are never modified',async()=>{
 for(const extra of [{roleNames:['turnli-host']},{roleNames:['turnli-host','turnli-cleaner']},{roleNames:['turnli-future']},{roleNames:'bad'},{verifiedEmail:false},{status:'disabled'},{userTenants:[{tenantId:'other',roleNames:['turnli-host']}]}]){
  const f=fixture(extra);await assert.rejects(provisionInvitedCleaner(f.user,f.sdk));assert.equal(f.calls.length,0);
 }
 const f=fixture();await assert.rejects(provisionInvitedCleaner({...f.user,email:'wrong@example.test'},f.sdk));assert.equal(f.calls.length,0);
});
test('effective tenant scope cannot be satisfied by a project role',async()=>{
 const old=process.env.TURNLI_TENANT_ID;process.env.TURNLI_TENANT_ID='legacy';
 try{
  const f=fixture({roleNames:['turnli-cleaner'],userTenants:[{tenantId:'legacy',roleNames:[]}]});
  await provisionInvitedCleaner(f.user,f.sdk);assert.deepEqual(f.calls,[['tenant','cleaner','legacy']]);
  const g=fixture({roleNames:['turnli-cleaner'],userTenants:[{tenantId:'legacy',roleNames:[]}]});g.sdk.management.user.addTenantRoles=async()=>({ok:true});await assert.rejects(provisionInvitedCleaner(g.user,g.sdk));
 }finally{if(old===undefined)delete process.env.TURNLI_TENANT_ID;else process.env.TURNLI_TENANT_ID=old;}
});
test('provider failure, unconfirmed role or changed scope fails closed',async()=>{
 for(const mode of ['failure','throw','no-role','scope']){
  const f=fixture();f.sdk.management.user.addRoles=async()=>{if(mode==='throw')throw Error('private provider error');if(mode==='scope'){f.data.roleNames=['turnli-cleaner'];f.data.email='other@example.test';}return {ok:mode!=='failure'};};
  await assert.rejects(provisionInvitedCleaner(f.user,f.sdk));
 }
});
test('wrong-email, expired and revoked invitation checks precede provisioning; failed setup never accepts',async()=>{
 for(const state of ['wrong-email','expired','revoked','valid']){
  const f=fixture(),r=response();let provisioned=0,accepted=0;
  const store={pending:async(u,invitation)=>{assert.equal(u.id,f.user.id);assert.equal(invitation,id);return state==='valid'?{id}:undefined},accept:async()=>{accepted++;return {id}}};
  await createHandler(async()=>f.user,()=>store,()=>assert.fail(),async()=>{provisioned++;throw Error('secret')})(request({action:'accept',id,email:'forged@example.test'}),r);
  assert.equal(r.code,state==='valid'?503:409);assert.equal(provisioned,state==='valid'?1:0);assert.equal(accepted,0);
  if(state==='valid'){assert.equal(r.data.code,'setup-incomplete');assert.match(r.data.error,/Account setup incomplete/);assert(!r.data.error.includes('secret'));}
 }
});
test('all supported sign-in methods reach the same explicit invitation provisioning boundary',async()=>{
 for(const action of ['invite-login','password-login','verify-code','set-password']){
  const f=fixture(),result={ok:true,data:{sessionJwt:'synthetic-session',refreshJwt:'synthetic-refresh'}};
  f.sdk.me=async()=>({ok:true,data:f.data});f.sdk.magicLink={verify:async()=>result};f.sdk.password={signIn:async()=>result,update:async()=>({ok:true})};f.sdk.otp={verify:{email:async()=>result}};
  const login=response();await accountHandler(()=>f.sdk)(request({action,email:f.data.email,password:'SyntheticPassword123!',code:'123456',token:'synthetic-link'}),login);assert.equal(login.code,200);assert.equal(f.calls.length,0);
  let accepted=false;const r=response();await createHandler(async()=>login.data.user,()=>({pending:async()=>({id}),accept:async()=>{assert.deepEqual(f.data.roleNames,['turnli-cleaner']);accepted=true;return {id}}}),()=>assert.fail(),u=>provisionInvitedCleaner(u,f.sdk))(request({action:'accept',id}),r);
  assert.equal(r.code,200);assert(accepted);assert.equal(f.calls.length,1);
 }
});
test('owner email-code bootstrap signs in only and never creates an account',async()=>{
 const sdk={otp:{signIn:{email:async e=>{assert.equal(e,OWNER_EMAIL);return {ok:true}}},signUpOrIn:{email:()=>assert.fail('must not create')}}};
 const r=response();await accountHandler(()=>sdk)(request({action:'send-code',email:OWNER_EMAIL}),r);assert.equal(r.code,200);
});
