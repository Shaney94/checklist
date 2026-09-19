const {currentUser,privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {can}=require('../../../lib/authorization.cjs');
const {uuid}=require('../../../lib/cleaning-jobs.cjs');
const {createStore}=require('../../../lib/completion-store.cjs');
const {validatePhoto,MIN_PHOTOS,MAX_PHOTOS,MAX_UPLOAD}=require('../../../lib/completion.cjs');
function createHandler(authenticate=currentUser,getStore=createStore,validate=validatePhoto){return async(req,res)=>{
 privateHeaders(res);res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});
  const host=can(user,'completion.review'),cleaner=can(user,'completion.submit'),b=req.body||{};
  if(!user.id||(!host&&!cleaner))return res.status(403).json({error:'Completion access is unavailable.'});
  if(req.method==='POST'&&!(host?['approve','issue']:['upload','remove','submit']).includes(b.action))return res.status(403).json({error:'You cannot perform this completion action.'});
  const id=req.method==='GET'?req.query?.jobId:b.jobId;
  if(!uuid(id))return res.status(400).json({error:'Choose a valid cleaning job.'});
  const store=getStore();
  if(req.method==='GET'&&req.query?.photoId){
   if(!uuid(req.query.photoId))return res.status(400).json({error:'Invalid photo.'});
   const photo=await store.photo(user,id,req.query.photoId,host);if(!photo)return res.status(404).json({error:'Photo not found.'});
   res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Disposition',`inline; filename="completion-${req.query.photoId}.jpg"`);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
   return res.status(200).end(Buffer.from(photo.data,'base64'));
  }
  const job=await store.view(user,id,host);if(!job)return res.status(404).json({error:'Completion not found for this account.'});
  if(req.method==='GET')return res.status(200).json({...job,requirements:{minPhotos:MIN_PHOTOS,maxPhotos:MAX_PHOTOS,maxUploadBytes:MAX_UPLOAD}});
  if(!Number.isSafeInteger(b.revision)||b.revision<0)return res.status(400).json({error:'Invalid revision.'});
  if(job.revision!==b.revision||job.state!==(host?'awaiting_review':'scheduled'))return res.status(409).json({error:'This clean changed or its evidence is locked. Reload completion.'});
  let result;
  if(b.action==='upload'){
   if(job.photos.length>=MAX_PHOTOS)return res.status(400).json({error:'A maximum of 6 photos is allowed.'});
   let photo;try{photo=await validate(b);}catch{return res.status(400).json({error:'Choose a valid JPEG, PNG or WebP image up to 3 MiB and 16 megapixels. Animated images are not supported.'});}
   result=await store.add(user.id,id,b.revision,photo);
  }else if(b.action==='remove'){
   if(!uuid(b.photoId))return res.status(400).json({error:'Invalid photo.'});
   result=await store.remove(user.id,id,b.revision,b.photoId);
  }else if(b.action==='submit')result=await store.submit(user.id,id,b.revision);
  else{
   const note=typeof b.note==='string'?b.note.trim():'';
   if(note.length>2000||(b.action==='issue'&&!note))return res.status(400).json({error:'Describe the issue in up to 2,000 characters.'});
   result=await store.review(user,id,b.revision,b.action==='approve'?'approved':'issue_reported',note||null);
  }
  return result?res.status(200).json(result):res.status(409).json({error:'Complete every checklist task and provide 3–6 different photos, or reload if the job changed. Submitted evidence cannot be edited.'});
 }catch{return res.status(503).json({error:'Completion could not be loaded or saved. Please retry.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
