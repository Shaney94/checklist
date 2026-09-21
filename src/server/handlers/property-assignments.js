const {currentUser,privateHeaders,validOrigin,email}=require('../../../lib/account.cjs');
const {can}=require('../../../lib/authorization.cjs');
const {uuid}=require('../../../lib/cleaning-jobs.cjs');
const {createStore}=require('../../../lib/property-assignment-store.cjs');
const {provisionInvitedCleaner}=require('../../../lib/invitation-onboarding.cjs');
const {deliverInvitation}=require('../../../lib/property-invitations.cjs');
const {detectSource,platforms}=require('../../../lib/booking-source.cjs');
const {createHash}=require('node:crypto');
function operationalCalendar(rows,month){
 const bookings=rows.filter(r=>r.id).flatMap(r=>(r.bookings||[]).filter(b=>!month||(b.arrival.date.slice(0,7)<=month&&b.checkout.date.slice(0,7)>=month)).map(b=>{
  const known=b.sourceEvidence&&platforms.find(p=>p.key===b.sourceKey&&p.name===b.source);
  const source=known?{source:known.name,sourceKey:known.key}:detectSource({feedURL:'https://'+r.feed_host});
  const boundary=(v,time)=>({date:v.date,...(v.allDay?{time:String(time).slice(0,5),timeSource:'property-rule'}:v.time?{time:v.time,timeSource:v.timeSource}:{})});
  return {id:createHash('sha256').update(r.id+':'+b.id).digest('hex'),property:r.propertyName,propertyId:r.propertyId,ownership:"assigned",...(source.source?{source:source.source,sourceKey:source.sourceKey}:{}),...(Number.isInteger(b.guests)&&b.guests>0?{guests:b.guests}:{}),arrival:boundary(b.arrival,r.check_in),checkout:boundary(b.checkout,r.check_out)};
 }));
 return {bookings,calendars:[],state:'ready',timeZone:'Europe/London',syncError:rows.some(r=>r.sync_error),hasCalendar:rows.some(r=>r.id)};
}
function createHandler(authenticate=currentUser,getStore=createStore,deliver=deliverInvitation,provision=provisionInvitedCleaner){return async(req,res)=>{
 privateHeaders(res);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});
  const host=can(user,'property.invite'),cleaner=can(user,'property.accept');
  const onboarding=user.authorizationState==='roleless';
  if(req.method==='GET'&&req.query?.action==='onboarding'){
   if(!user.id||(!onboarding&&user.authorizationState!=='cleaner'))return res.status(403).json({error:'Invitation onboarding is unavailable for this account.'});
   return res.status(200).json({invitations:await getStore().onboarding(user)});
  }
  const accepting=onboarding&&req.method==='POST'&&req.body?.action==='accept';
  if(!user.id||(!host&&!cleaner&&!accepting))return res.status(403).json({error:'Property assignments are unavailable for this account.'});
  const b=req.body||{};
  if(req.method==='POST'&&!(host?['invite','revoke']:['accept','decline']).includes(b.action))return res.status(403).json({error:'You cannot perform this assignment action.'});
  const store=getStore();
  if(req.method==='GET'){
   if(host){if(!uuid(req.query?.propertyId))return res.status(400).json({error:'Choose a property.'});return res.status(200).json({assignments:await store.host(user.workspaceId,req.query.propertyId)});}
   if(req.query?.action){
    if((!uuid(req.query.id)&&!(req.query.id==='all'&&req.query.action==='calendar'))||!['guide','calendar'].includes(req.query.action))return res.status(400).json({error:'Choose an assigned property.'});
    if(req.query.action==='guide'){const guide=await store.guide(user.id,req.query.id);return guide?res.status(200).json(guide):res.status(404).json({error:'Property access is no longer available.'});}
    const rows=await store.calendars(user.id,req.query.id);if(!rows.length&&req.query.id!=='all')return res.status(404).json({error:'Property access is no longer available.'});
    const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)?req.query.month:null;
    return res.status(200).json(operationalCalendar(rows,month));
   }
   return res.status(200).json({assignments:await store.inbox(user)});
  }
  if(b.action==='invite'){
   const address=email(b.email);if(!uuid(b.propertyId)||!address)return res.status(400).json({error:'Choose a property and enter a valid email address.'});
   const invitation=await store.invite(user,b.propertyId,address);if(!invitation)return res.status(409).json({error:'An assignment is already pending or active, the property is unavailable, or the invitation limit was reached. Reload properties.'});
   try{await deliver(address);await store.delivered(user.workspaceId,invitation.id,true);}catch{await store.delivered(user.workspaceId,invitation.id,false);return res.status(503).json({error:'The invitation was saved, but email delivery could not be confirmed. The Cleaner can sign in with the invited email to accept it. Revoke the invitation if it is no longer needed.'});}
   return res.status(201).json({sent:true});
  }
  if(!uuid(b.id))return res.status(400).json({error:'Choose a valid invitation.'});
  if(b.action==='accept'){
   // Validate server-held invitation intent before any provider mutation. accept()
   // rechecks under the workspace lock, including revocation/expiry during setup.
   if(!await store.pending(user,b.id))return res.status(409).json({error:'This invitation expired, changed or is unavailable for this account.'});
   try{await provision(user);}catch{return res.status(503).json({code:'setup-incomplete',error:'Account setup incomplete. Your invitation has not been accepted. Try Accept invitation again, or contact support if this continues.'});}
  }
  const result=b.action==='revoke'?await store.revoke(user.workspaceId,b.id):b.action==='accept'?await store.accept(user,b.id):await store.decline(user,b.id);
  return result?res.status(200).json({saved:true}):res.status(409).json({error:'This invitation expired, changed or is unavailable for this account. Reload assignments.'});
 }catch{return res.status(503).json({error:'Property assignments could not be loaded or saved. Please retry.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.operationalCalendar=operationalCalendar;
