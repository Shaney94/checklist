const createClient=require('@descope/node-sdk');
const OWNER_EMAIL='s.landerson@outlook.com';
const ORIGIN='https://turnli.vercel.app';
const SESSION='__Host-turnly-session', REFRESH='__Host-turnly-refresh';
let client;
function getClient(){
 if(!process.env.DESCOPE_PROJECT_ID) throw new Error('Accounts not configured');
 return client ||= createClient({projectId:process.env.DESCOPE_PROJECT_ID,baseUrl:process.env.NEXT_PUBLIC_DESCOPE_BASE_URL||'https://api.descope.com',managementKey:process.env.DESCOPE_MANAGEMENT_KEY});
}
function email(value){const e=typeof value==='string'?value.trim().toLowerCase():'';return e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e:null;}
function cookie(req,name){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookies(res,session,refresh){
 const items=[`${SESSION}=${session||''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session?600:0}`];
 if(refresh!==undefined) items.push(`${REFRESH}=${refresh||''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${refresh?2592000:0}`);
 res.setHeader('Set-Cookie',items);
}
async function currentUser(req,res,sdk){
 let token=cookie(req,SESSION);
 let refresh=cookie(req,REFRESH);
 try { await sdk.validateSession(token); }
 catch {
  if(!refresh) return null;
  try { const renewed=await sdk.refreshSession(refresh);token=renewed.jwt;refresh=renewed.refreshJwt||refresh;setCookies(res,token,refresh); }
  catch {setCookies(res,'','');return null;}
 }
 if(!refresh) return null;
 const result=await sdk.me(refresh);
 if(!result.ok||!result.data) return null;
 return {email:result.data.email,canInvite:result.data.verifiedEmail===true&&email(result.data.email)===OWNER_EMAIL};
}
function validOrigin(req){
 const allowed=[ORIGIN];
 if(process.env.VERCEL_URL) allowed.push('https://'+process.env.VERCEL_URL);
 return allowed.includes(req.headers.origin);
}
function createHandler(getSdk=getClient){return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
 if(req.method==='POST'&&(!validOrigin(req)||!(req.headers['content-type']||'').startsWith('application/json'))) return res.status(403).json({error:'Please use the Turnly website.'});
 try {
  const sdk=getSdk();
  if(req.method==='GET'){const user=await currentUser(req,res,sdk);return res.status(200).json({user,invitationsReady:!!process.env.DESCOPE_MANAGEMENT_KEY});}
  const body=req.body;
  if(!body||typeof body!=='object'||JSON.stringify(body).length>2048) return res.status(400).json({error:'Invalid request'});
  if(body.action==='logout'){const refresh=cookie(req,REFRESH);if(refresh) await sdk.logout(refresh);setCookies(res,'','');return res.status(200).json({ok:true});}
  if(body.action==='send-code'){
   const address=email(body.email);if(!address) return res.status(400).json({error:'Enter a valid email address.'});
   const result=address===OWNER_EMAIL?await sdk.otp.signUpOrIn.email(address):await sdk.otp.signIn.email(address);
   if(!result.ok) {
    if(result.error?.errorCode==='E061001') return res.status(503).json({error:'Email sign-in is not enabled yet. Please contact your host.'});
    return res.status(result.code===429?429:400).json({error:result.code===429?'Please wait before requesting another code.':'Unable to send a code. Please check your invitation and email address, then try again.'});
   }
   return res.status(200).json({ok:true});
  }
  if(body.action==='verify-code'){
   const address=email(body.email);if(!address||typeof body.code!=='string'||!/^\d{6}$/.test(body.code)) return res.status(400).json({error:'Enter the six-digit email code.'});
   const result=await sdk.otp.verify.email(address,body.code);
   if(!result.ok||!result.data?.sessionJwt||!result.data?.refreshJwt) return res.status(400).json({error:'The code is incorrect or expired. Please try again or request a new code.'});
   setCookies(res,result.data.sessionJwt,result.data.refreshJwt);
   const me=await sdk.me(result.data.refreshJwt);
   if(!me.ok||!me.data) return res.status(502).json({error:'Unable to confirm your account. Please try again.'});
   return res.status(200).json({user:{email:me.data.email,canInvite:me.data.verifiedEmail===true&&email(me.data.email)===OWNER_EMAIL}});
  }
  if(body.action==='invite'){
   const user=await currentUser(req,res,sdk);
   if(!user) return res.status(401).json({error:'Please sign in before sending an invitation.'});
   if(!user.canInvite) return res.status(403).json({error:'Only the Turnly owner can send customer invitations.'});
   if(!process.env.DESCOPE_MANAGEMENT_KEY) return res.status(503).json({error:'Customer invitations are not ready yet. Your account connection still needs to be completed.'});
   const address=email(body.email);if(!address||address===OWNER_EMAIL) return res.status(400).json({error:'Enter your customer’s email address.'});
   const result=await sdk.management.user.invite(address,{email:address,inviteUrl:ORIGIN+'/?join=1',sendMail:true,sendSMS:false});
   if(!result.ok) return res.status(result.code===429?429:400).json({error:result.code===429?'Please wait before sending another invitation.':'Invitation was not sent. The customer may already have an account; please check and try again.'});
   return res.status(200).json({sent:true});
  }
  return res.status(400).json({error:'Unknown action'});
 }catch {return res.status(503).json({error:'Account service is temporarily unavailable. Please try again shortly.'});}
};}
module.exports={createHandler,email,OWNER_EMAIL};
