const createClient = require('@descope/node-sdk');
const OWNER_EMAIL = 's.landerson@outlook.com';
const ORIGIN = 'https://turnli.vercel.app';
// Keep existing cookie names so the upgrade preserves signed-in sessions.
const SESSION = '__Host-turnly-session', REFRESH = '__Host-turnly-refresh';
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
 return {id:user.userId,email:user.email,canInvite:email(user.email)===OWNER_EMAIL,legacyAccess:!!legacy,workspaceId:legacy?'org:'+process.env.TURNLI_TENANT_ID:'user:'+user.userId};
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
function validOrigin(req) {return [ORIGIN,process.env.VERCEL_URL&&'https://'+process.env.VERCEL_URL].includes(req.headers.origin);}
function authFailure(res,result,fallback) {
  const code=result.error?.errorCode;
  // Log diagnostic codes only: no email, password, token or provider response body.
  console.warn('Turnli authentication failure',code||'provider_error',result.code);
  if(code==='E061001') return res.status(503).json({error:'This login method is not enabled yet. Please use the other login option or contact your host.'});
  if(result.code===429) {res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many requests. Please wait a minute before trying again.',retryAfter:60});}
  return res.status(400).json({error:fallback});
}
async function completeLogin(res,sdk,result) {
  if(!result.ok||!result.data?.sessionJwt||!result.data?.refreshJwt) return authFailure(res,result,'We couldn’t log you in. Check your details and try again.');
  const me=await sdk.me(result.data.refreshJwt);
  if(!me.ok||!permitted(me.data)) return res.status(403).json({error:'Please verify your email using Email me a login code before logging in.'});
  setCookies(res,result.data.sessionJwt,result.data.refreshJwt);
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
    if(body.action==='logout') {
      const refresh=cookie(req,REFRESH);
      if(refresh){const result=await sdk.logout(refresh);if(!result.ok)return res.status(503).json({error:'We couldn’t complete sign out. Please try again.'});}
      setCookies(res,'','');return res.status(200).json({ok:true});
    }
    if(body.action==='register') {
      const address=email(body.email);
      if(!address||typeof body.password!=='string'||body.password.length<8||body.password.length>1024)return res.status(400).json({error:'Enter your email and a password that meets the requirements.'});
      const registered=await sdk.password.signUp(address,body.password,{email:address});
      if(!registered.ok){
        if(registered.error?.errorCode==='E062107')return res.status(409).json({error:'An account with this email already exists. Continue with an email code to verify your email and log in, or use your existing password. The password entered here has not changed your account password.',code:'E062107',nextAction:'verify-existing'});
        const code=registered.error?.errorCode;
        return authFailure(res,registered,'We couldn’t create your account.'+(typeof code==='string'&&/^E[0-9]+$/.test(code)?' Reference: '+code+'.':'')+' Please try again or contact support with this message.');
      }
      // Do not issue application cookies until Descope verifies the email address.
      const sent=await sdk.otp.signIn.email(address);
      if(!sent.ok)return authFailure(res,sent,'Your account was created, but we couldn’t send the verification code. Use Email me a login code to try again.');
      return res.status(200).json({verificationRequired:true,retryAfter:60});
    }
    if(['send-code','verify-code','password-login','set-password'].includes(body.action)) {
      const address=email(body.email);if(!address)return res.status(400).json({error:'Enter a valid email address.'});
      if(body.action==='send-code') {
        const result=address===OWNER_EMAIL?await sdk.otp.signUpOrIn.email(address):await sdk.otp.signIn.email(address);
        if(!result.ok)return authFailure(res,result,'We couldn’t send your code. Try again or log in with your password. Check that you’re using your invited email address.');
        return res.status(200).json({ok:true,retryAfter:60});
      }
      if(body.action==='password-login') {
        if(typeof body.password!=='string'||!body.password||body.password.length>1024)return res.status(400).json({error:'Enter your password.'});
        const result=await sdk.password.signIn(address,body.password);
        if(!result.ok)return authFailure(res,result,'We couldn’t log you in. Check your email and password, or use Forgot password.');
        return completeLogin(res,sdk,result);
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
      if(!user.canInvite)return res.status(403).json({error:'Only the Turnli owner can send customer invitations.'});
      if(!process.env.DESCOPE_MANAGEMENT_KEY||!process.env.TURNLI_TENANT_ID)return res.status(503).json({error:'Customer invitations are not configured yet.'});
      const address=email(body.email);if(!address||address===OWNER_EMAIL)return res.status(400).json({error:'Enter your customer’s email address.'});
      const result=await sdk.management.user.invite(address,{email:address,inviteUrl:ORIGIN+'/?join=1',sendMail:true,sendSMS:false,userTenants:[{tenantId:process.env.TURNLI_TENANT_ID,roleNames:[]}]});
      if(!result.ok)return authFailure(res,result,'Invitation was not sent. The customer may already have an account; please check and try again.');
      return res.status(200).json({sent:true});
    }
    return res.status(400).json({error:'Unknown action'});
  }catch {return res.status(503).json({error:'Account service is temporarily unavailable. Please try again shortly.'});}
};}
module.exports={createHandler,email,OWNER_EMAIL,currentUser,getClient,privateHeaders,setCookies,validOrigin,accountUser};
