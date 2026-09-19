const {currentUser,privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {can}=require('../../../lib/authorization.cjs');
const {createStore:workspaceStore}=require('../../../lib/dashboard-store.cjs');
const {createStore:guideStore}=require('../../../lib/property-guide-store.cjs');
const {validateGuide}=require('../../../lib/property-guide.cjs');
function createHandler(authenticate=currentUser,getWorkspace=workspaceStore,getGuides=guideStore){return async(req,res)=>{
 privateHeaders(res);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});
  // Workspace-wide Cleaner membership does not establish a property/job assignment.
  // Deny before looking up property existence or touching sensitive storage.
  if(!user.id||!can(user,req.method==='GET'?'guide.read':'guide.write'))return res.status(403).json({error:'Start Guide access requires verified property/job authorization. It is not available for this account.'});
  const id=req.method==='GET'?req.query?.id:req.body?.id;
  if(typeof id!=='string'||!id||id.length>100)return res.status(400).json({error:'Choose a valid property.'});
  const saved=await getWorkspace().load(user.workspaceId);
  if(!saved.data.properties.some(p=>p.id===id))return res.status(404).json({error:'Property not found.'});
  if(req.method==='GET')return res.status(200).json(await getGuides().load(user.workspaceId,id));
  const body=req.body;
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return res.status(400).json({error:'Invalid guide revision.'});
  let guide;try{guide=validateGuide(body.guide);}catch{return res.status(400).json({error:'Use plain text, up to 5,000 characters per section.'});}
  const result=await getGuides().save(user.workspaceId,id,body.revision,guide);
  if(!result)return res.status(409).json({error:'This property or guide changed. Reload the guide before saving again.'});
  return res.status(200).json(result);
 }catch{return res.status(503).json({error:'The Start Guide could not be loaded or saved. Please retry.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
