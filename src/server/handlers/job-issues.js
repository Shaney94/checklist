const {currentUser,privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {can}=require('../../../lib/authorization.cjs');
const {uuid}=require('../../../lib/cleaning-jobs.cjs');
const {createStore}=require('../../../lib/job-issue-store.cjs');
const {validateIssue}=require('../../../lib/job-issues.cjs');
const {validatePhoto}=require('../../../lib/completion.cjs');
function createHandler(authenticate=currentUser,getStore=createStore,validate=validatePhoto){return async(req,res)=>{
 privateHeaders(res);res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});
  const host=can(user,'issues.review'),cleaner=can(user,'issues.report');
  if(!user.id||(!host&&!cleaner)||(req.method==='POST'&&!cleaner))return res.status(403).json({error:'You cannot report or view this clean’s issues.'});
  const b=req.body||{},id=req.method==='GET'?req.query?.jobId:b.jobId;
  if(!uuid(id))return res.status(400).json({error:'Choose a cleaning job.'});
  const store=getStore();
  if(req.method==='GET'&&req.query?.photoId){
   if(!uuid(req.query.photoId))return res.status(400).json({error:'Invalid photo.'});
   const photo=await store.photo(user,id,req.query.photoId,host);if(!photo)return res.status(404).json({error:'Photo unavailable.'});
   res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Disposition','inline; filename="issue.jpg"');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");return res.status(200).end(Buffer.from(photo.data,'base64'));
  }
  const job=await store.job(user,id,host);if(!job)return res.status(404).json({error:'This job is no longer available to you.'});
  if(req.method==='GET')return res.status(200).json({...job,issues:await store.list(user,id,host)});
  if(job.state!=='scheduled'||b.revision!==job.revision)return res.status(409).json({error:'This clean changed. Open it again before reporting the issue.'});
  if(!uuid(b.id))return res.status(400).json({error:'Invalid issue request.'});
  let issue;try{issue=validateIssue(b);}catch{return res.status(400).json({error:'Choose a category and describe the issue in up to 2,000 characters.'});}
  let photo=null;if(b.photo){try{photo=await validate(b.photo);}catch{return res.status(400).json({error:'Choose a JPEG, PNG or WebP photo up to 3 MiB and 16 megapixels.'});}}
  const saved=await store.create(user.id,id,job.revision,b.id,issue,photo);
  return saved?res.status(201).json(saved):res.status(409).json({error:'The issue was already recorded, the clean changed, or its issue limit was reached. Check the saved issues before trying again.'});
 }catch{return res.status(503).json({error:'Issues could not be loaded or saved. Please try again.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
