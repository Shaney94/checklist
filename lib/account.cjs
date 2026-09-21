const {resolveRole,roleState,registrationRoles}=require('./authorization.cjs');
const createClient = require('@descope/node-sdk');
const OWNER_EMAIL = 's.landerson@outlook.com';
const ORIGIN = 'https://turnli.io';
// Keep existing cookie names so the upgrade preserves signed-in sessions.
const SESSION = '__Host-turnly-session', REFRESH = '__Host-turnly-refresh';
const PENDING='__Host-turnli-verification';
function pendingCookie(res,token='') {res.setHeader('Set-Cookie',[`${PENDING}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${token?tokenLifetime(token,900):0}`]);}
let client;
function getClient() {
  if (!process.env.DESCOPE_PROJECT_ID) throw new Error('Accounts not configured');
  return client ||= createClient({projectId:process.env.DESCOPE_PROJECT_ID,baseUrl:process.env.NEXT_PUBLIC_DESCOPE_BASE_URL||'https://api.descope.com',managementKey:process.env.DESCOPE_MANAGEMENT_KEY});
}
function email(value) { const e=typeof value==='string'?value.trim().toLowerCase():'';return e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e:null; }
function cookie(req,name) { return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''; }
function tokenLifetime(token,maximum) {
  // Expiry only controls cookie storage; the provider still verifies authenticity.
  try {const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));return Math.max(0,Math.min(maximum,Math.floor(claims.exp-Date.now()/1000)));} catch {return maximum;}
}
function setCookies(res,session,refresh) {
  const values=[`${SESSION}=${session||''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session?tokenLifetime(session,600):0}`];
  if(refresh!==undefined) values.push(`${REFRESH}=${refresh||''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${refresh?tokenLifetime(refresh,2592000):0}`);
  res.setHeader('Set-Cookie',values);
}
function privateHeaders(res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet');
}
function permitted(user){return user?.verifiedEmail===true&&!!user.userId&&user.status!=='disabled';}
function accountUser(user){
 const legacy=email(user.email)===OWNER_EMAIL||(!!process.env.TURNLI_TENANT_ID&&user.userTenants?.some(t=>t.tenantId===process.env.TURNLI_TENANT_ID));
 return {id:user.userId,email:user.email,canInvite:email(user.email)===OWNER_EMAIL,legacyAccess:!!legacy,workspaceId:legacy?'org:'+process.env.TURNLI_TENANT_ID:'user:'+user.userId,authorizationState:roleState(user,legacy?process.env.TURNLI_TENANT_ID:undefined),role:resolveRole(user,legacy?process.env.TURNLI_TENANT_ID:undefined)};
}
async function currentUser(req,res,sdk=getClient()) {
  let token=cookie(req,SESSION),refresh=cookie(req,REFRESH);
  if(!refresh) return null;
  try {await sdk.validateSession(token);} catch {
    try {const renewed=await sdk.refreshSession(refresh);token=renewed.jwt;refresh=renewed.refreshJwt||refresh;setCookies(res,token,refresh);}
    catch {setCookies(res,'','');return null;}
  }
  const result=await sdk.me(refresh);
  if(!result.ok || !permitted(result.data) || !email(result.data.email) || result.data.status==='disabled') {setCookies(res,'','');return null;}
  return accountUser(result.data);
}
function validOrigin(req) {
  const origin=req.headers.origin;
  if([ORIGIN,'https://turnli.vercel.app'].includes(origin))return true;
  // Hosted deployments retain the exact production allowlist. Never derive trust from Host.
  if(process.env.VERCEL||process.env.VERCEL_ENV)return false;
  const local=process.env.TURNLI_LOCAL_ORIGIN;
  if(local){
    const match=/^http:\/\/(?:localhost|127\.0\.0\.1):([1-9]\d{0,4})$/.exec(local);
    return !!match&&Number(match[1])<=65535&&origin===local;
  }
  return process.env.NODE_ENV==='development'&&['http://localhost:3000','http://127.0.0.1:3000'].includes(origin);
}
function authFailure(res,result,fallback) {
  const code=result.error?.errorCode;
  // Log diagnostic codes only: no email, password, token or provider response body.
  console.warn('Turnli authentication failure',code||'provider_error',result.code);
  if(code==='E061001') return res.status(503).json({error:'This login method is not enabled yet. Please use the other login option or contact your host.'});
  if(result.code===429) {res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many requests. Please wait a minute before trying again.',retryAfter:60});}
  return res.status(400).json({error:fallback});
}
async function completeLogin(res,sdk,result,allowVerification=false) {
  if(!result.ok||!result.data?.sessionJwt||!result.data?.refreshJwt) return authFailure(res,result,'We couldn’t log you in. Check your details and try again.');
  const me=await sdk.me(result.data.refreshJwt);
  if(allowVerification&&me.ok&&me.data?.userId&&me.data.status!=='disabled'&&me.data.verifiedEmail===false){
    pendingCookie(res,result.data.refreshJwt);
    return res.status(200).json({verificationRequired:true});
  }
  if(!me.ok||!permitted(me.data)) return res.status(403).json({error:'Please verify your email using Email me a login code before logging in.'});
  setCookies(res,result.data.sessionJwt,result.data.refreshJwt);
  res.setHeader('Set-Cookie',[...res.getHeader('Set-Cookie'),`${PENDING}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`]);
  return res.status(200).json({user:accountUser(me.data)});
}
function createHandler(getSdk=getClient) {return async function handler(req,res) {
  privateHeaders(res);
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  if(req.method==='POST'&&(!validOrigin(req)||!(req.headers['content-type']||'').startsWith('application/json'))) return res.status(403).json({error:'Please use the Turnli website.'});
  try {
    const sdk=getSdk();
    if(req.method==='GET') {
      if(req.query?.action==='policy'){const result=await sdk.password.policy();if(!result.ok)return authFailure(res,result,'Password requirements could not load.');return res.status(200).json({policy:result.data});}
      return res.status(200).json({user:await currentUser(req,res,sdk),invitationsReady:!!process.env.DESCOPE_MANAGEMENT_KEY});
    }
    const body=req.body;
    if(!body||typeof body!=='object'||JSON.stringify(body).length>4096)return res.status(400).json({error:'Invalid request'});
    if(body.action==='invite-login') {
      if(typeof body.token!=='string'||!body.token||body.token.length>2048)return res.status(400).json({error:'This sign-in link is invalid. Request a new email login link.'});
      const verified=await sdk.magicLink.verify(body.token);
      if(!verified.ok)return res.status(400).json({error:'This sign-in link expired or was already used. Use your password or request an email login code.'});
      return completeLogin(res,sdk,verified);
    }
    if(body.action==='logout') {
      const refresh=cookie(req,REFRESH);
      if(refresh){const result=await sdk.logout(refresh);if(!result.ok)return res.status(503).json({error:'We couldn’t complete sign out. Please try again.'});}
      setCookies(res,'','');return res.status(200).json({ok:true});
    }
    if(body.action==='register') {
      if(!Object.hasOwn(registrationRoles,body.role)||Object.keys(body).some(k=>!['action','email','password','role'].includes(k)))return res.status(400).json({error:'Choose Host or Cleaner to create your account.'});
      if(!process.env.DESCOPE_MANAGEMENT_KEY)return res.status(503).json({nextAction:'setup-required',error:'New account setup is temporarily unavailable. Please try again later.'});
      const address=email(body.email);
      if(!address||typeof body.password!=='string'||body.password.length<8||body.password.length>1024)return res.status(400).json({error:'Enter your email and a password that meets the requirements.'});
      const registered=await sdk.password.signUp(address,body.password,{email:address});
      if(!registered.ok){
        if(registered.error?.errorCode==='E062107')return res.status(409).json({error:'An account with this email already exists. Log in with the password you originally created to continue email verification. The password entered here has not changed your account password.',code:'E062107',nextAction:'verify-existing'});
        if(registered.code>=500)return res.status(503).json({error:'The signup service could not confirm account creation. Continue with email verification before trying signup again.'});
        const code=registered.error?.errorCode;
        return authFailure(res,registered,'We couldn’t create your account.'+(typeof code==='string'&&/^E[0-9]+$/.test(code)?' Reference: '+code+'.':'')+' Please try again or contact support with this message.');
      }
      // Only the fresh signup token can identify the account to provision. Never
      // use a request-supplied user ID, tenant, provider role or an existing login.
      const created=registered.data?.refreshJwt?await sdk.me(registered.data.refreshJwt):null;
      const u=created?.data;
      if(!created?.ok||!u?.userId||email(u.email)!==address||u.status==='disabled'||u.userTenants?.length||u.roleNames?.some(r=>r.startsWith('turnli-'))||accountUser(u).legacyAccess)
        return res.status(503).json({nextAction:'setup-required',error:'Your account was created, but its workspace role could not be confirmed. Contact support before continuing.'});
      const provisioned=await sdk.management.user.addRoles(u.userId,[registrationRoles[body.role]]);
      if(!provisioned.ok)return res.status(503).json({nextAction:'setup-required',error:'Your account was created, but workspace setup could not finish. Contact support before continuing.'});
      // Creation is complete. Email delivery is a separate, retryable operation.
      // Never turn an email failure into a failed account-creation response.
      // Only a short-lived verification cookie is issued, never a dashboard session.
      if(registered.data?.refreshJwt)pendingCookie(res,registered.data.refreshJwt);
      return res.status(201).json({accountCreated:true,verificationRequired:true});
    }
    if(['send-code','verify-code','password-login','set-password'].includes(body.action)) {
      const address=email(body.email);if(!address)return res.status(400).json({error:'Enter a valid email address.'});
      if(body.action==='send-code') {
        let result;
        const pending=cookie(req,PENDING);
        if(pending){
          const me=await sdk.me(pending);
          if(me.ok&&me.data?.userId&&me.data.status!=='disabled'&&email(me.data.email)===address&&me.data.verifiedEmail===false){
            // Verify only the provider-authenticated account's existing address.
            // Never accept a caller-selected replacement address or merge accounts.
            result=await sdk.otp.update.email(address,address,pending);
          }
        }
        result ||= await sdk.otp.signIn.email(address);
        if(!result.ok&&result.error?.errorCode==='E062115')return res.status(409).json({error:'Your account exists, but your email is not verified. Log in with the password you originally created; we’ll then send your verification code.',nextAction:'password-verification'});
        if(!result.ok)return authFailure(res,result,'We couldn’t send your code. Try again or log in with your password. Check that you’re using the email address for your account.');
        return res.status(200).json({ok:true,retryAfter:60});
      }
      if(body.action==='password-login') {
        if(typeof body.password!=='string'||!body.password||body.password.length>1024)return res.status(400).json({error:'Enter your password.'});
        const result=await sdk.password.signIn(address,body.password);
        if(!result.ok)return authFailure(res,result,'We couldn’t log you in. Check your email and password, or use Forgot password.');
        return completeLogin(res,sdk,result,true);
      }
      if(typeof body.code!=='string'||!/^\d{6}$/.test(body.code))return res.status(400).json({error:'Enter the six-digit email code.'});
      if(body.action==='set-password'&&(typeof body.password!=='string'||body.password.length<8||body.password.length>1024))return res.status(400).json({error:'Choose a password of at least 8 characters that meets the requirements.'});
      const verified=await sdk.otp.verify.email(address,body.code);
      if(!verified.ok||!verified.data?.refreshJwt)return authFailure(res,verified,'That code is incorrect or expired. Try again or request a new code.');
      if(body.action==='set-password') {
        // Always require a fresh provider-verified code for password changes.
        const updated=await sdk.password.update(address,body.password,verified.data.refreshJwt);
        if(!updated.ok)return authFailure(res,updated,'Your password could not be saved. Check the password requirements and request a new code to try again.');
      }
      return completeLogin(res,sdk,verified);
    }
    if(body.action==='invite') {
      const user=await currentUser(req,res,sdk);if(!user)return res.status(401).json({error:'Please log in before sending an invitation.'});
      if(!user.canInvite||!['host','cleaner'].includes(user.authorizationState))return res.status(403).json({error:'Explicit workspace authorization is required.'});
      // Legacy customer invitations have no trustworthy Host/Cleaner role intent.
      // Preserve existing records, but do not create more roleless memberships.
      return res.status(410).json({error:'Customer invitations are no longer available. Hosts can invite a Cleaner from their property.'});
    }
    return res.status(400).json({error:'Unknown action'});
  }catch {return res.status(503).json({error:'Account service is temporarily unavailable. Please try again shortly.'});}
};}
module.exports={createHandler,email,OWNER_EMAIL,ORIGIN,currentUser,getClient,privateHeaders,setCookies,validOrigin,accountUser};
