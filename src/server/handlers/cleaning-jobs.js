const {currentUser,privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {can}=require('../../../lib/authorization.cjs');
const {createStore}=require('../../../lib/cleaning-job-store.cjs');
const {uuid,code,date,eligibleCleaner}=require('../../../lib/cleaning-jobs.cjs');
function createHandler(authenticate=currentUser,getStore=createStore,eligible=eligibleCleaner,getContext=require('../../../lib/cleaner-context-store.cjs').createStore){return async(req,res)=>{
 privateHeaders(res);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});
  const host=can(user,'jobs.manage'),cleaner=can(user,'jobs.assigned');
  if(!user.id||(!host&&!cleaner))return res.status(403).json({error:'Cleaning jobs are not available for this account.'});
  const b=req.body||{};
  if(req.method==='POST'&&!(host?['create','assign','unassign','cancel']:['code','replace-code','check']).includes(b.action))return res.status(403).json({error:'You do not have permission to perform this job action.'});
  if(req.method==='GET'&&req.query?.id&&!cleaner)return res.status(403).json({error:'Use the Host job list.'});
  if(req.method==='GET'&&req.query?.action==='properties'){
   if(!cleaner)return res.status(403).json({error:'Cleaner property context only.'});
   return res.status(200).json({properties:await getContext().properties(user)});
  }
  const store=getStore();
  if(req.method==='GET'){
   if(req.query?.id){
    if(!uuid(req.query.id))return res.status(400).json({error:'Invalid job.'});
    const job=await store.assigned(user.id,req.query.id);
    if(!job)return res.status(404).json({error:'Assigned job not found.'});
    // Only operational job fields may cross the Host–Cleaner boundary.
    const fields=['id','propertyId','propertyName','date','kind','state','automatic','plannedAfter','needsAttention','tasks','checked','revision','faqs'];
    return res.status(200).json(Object.fromEntries(fields.filter(key=>Object.hasOwn(job,key)).map(key=>[key,job[key]])));
   }
   return res.status(200).json({jobs:await store.list(user,host),...(cleaner?{hasCode:await store.code(user.id)}:{})});
  }
  if(b.action==='code'||b.action==='replace-code'){
   if(!cleaner)return res.status(403).json({error:'Only Cleaners can generate an assignment code.'});
   if(b.action==='replace-code'){
    if(b.confirm!==true)return res.status(400).json({error:'Confirm replacement. The previous code will stop working.'});
    return res.status(200).json({code:await store.rotateCode(user.id),legacy:false});
   }
   return res.status(200).json(await store.ensureCode(user.id));
  }
  if(b.action==='check'){
   if(!cleaner)return res.status(403).json({error:'Only the assigned Cleaner can update tasks.'});
   if(!uuid(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0||!Number.isSafeInteger(b.index)||b.index<0||typeof b.checked!=='boolean')return res.status(400).json({error:'Invalid task update.'});
   const result=await store.check(user.id,b.id,b.revision,b.index,b.checked);
   return result?res.status(200).json({saved:true}):res.status(409).json({error:'This job changed or is no longer assigned to you. Reload jobs.'});
  }
  if(!host)return res.status(403).json({error:'Only Hosts can manage cleaning jobs.'});
  if(b.action==='create'){
   if(!uuid(b.propertyId)||!date(b.date)||!['regular','deep'].includes(b.kind))return res.status(400).json({error:'Choose a property, valid date and clean type.'});
   const result=await store.create(user.workspaceId,b.propertyId,b.date,b.kind);
   return result?res.status(201).json(result):res.status(404).json({error:'Property not found.'});
  }
  if(!['assign','unassign','cancel'].includes(b.action)||!uuid(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0)return res.status(400).json({error:'Invalid job update.'});
  const job=await store.hostJob(user.workspaceId,b.id);
  if(!job)return res.status(404).json({error:'Job not found.'});
  if(job.state!=='scheduled'||job.revision!==b.revision)return res.status(409).json({error:'This job changed or was cancelled. Reload jobs.'});
  if(job.automatic&&b.action!=='cancel')return res.status(409).json({error:'Turnover jobs use the property’s assigned Cleaner. Manage the property assignment instead.'});
  let result;
  if(b.action==='cancel')result=await store.cancel(user.workspaceId,b.id,b.revision);
  else {
   let assignee=null;
   if(b.action==='assign'){
    if(code(b.code))assignee=await store.cleaner(b.code);
    if(!assignee||!await eligible(assignee))return res.status(400).json({error:'Assignment code is invalid or the Cleaner is unavailable.'});
   }
   result=await store.assign(user.workspaceId,b.id,b.revision,assignee,b.action==='assign'?b.code:null);
  }
  return result?res.status(200).json({saved:true}):res.status(409).json({error:'The job or assignment code changed. Reload and try again.'});
 }catch{return res.status(503).json({error:'Cleaning jobs are unavailable. Please retry.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
