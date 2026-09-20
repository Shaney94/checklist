const {currentUser,privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {managedWorkspace,can,home}=require('../../../lib/authorization.cjs');
const {createStore}=require('../../../lib/dashboard-store.cjs');
const {change}=require('./dashboard.js');
const {quote,QuoteInputError}=require('../../../lib/cleaning-price.cjs');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function createHandler(authenticate=currentUser,getStore=createStore){return async(req,res)=>{
 privateHeaders(res);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in to save your property and quote.'});
  const owner=managedWorkspace(user);if(!owner||!can(user,'workspace.setup'))return res.status(403).json({error:'Your account cannot save property details.'});
  const id=req.method==='GET'?req.query?.id:req.body?.id;
  if(req.method==='GET'&&!id){const saved=await getStore().load(owner);return res.status(200).json({quotes:saved.data.properties.filter(p=>p.cleaningQuote?.createdBy===user.id).map(p=>({propertyId:p.id,quote:p.cleaningQuote.quote,workspace:home(user)}))});}
  if(!uuid(id))return res.status(400).json({error:'Invalid quote reference.'});
  if(req.method==='POST'&&Object.keys(req.body).some(k=>!['id','details'].includes(k)))return res.status(400).json({error:'Send property details only.'});
  // Always recalculate server-side; neither quoted amounts nor workspace IDs are accepted.
  const calculated=req.method==='POST'?quote(req.body.details):null;
  const store=getStore();
  for(let attempt=0;attempt<3;attempt++){
   const saved=await store.load(owner);
   const existing=saved.data.properties.find(p=>p.cleaningQuote?.requestId===id&&p.cleaningQuote?.createdBy===user.id);
   const result=p=>({saved:true,propertyId:p.id,quote:p.cleaningQuote.quote,workspace:home(user)});
   if(existing)return res.status(200).json(result(existing));
   if(req.method==='GET')return res.status(404).json({error:'Saved quote not found.'});
   if(saved.data.properties.length>=100)return res.status(409).json({error:'Your workspace has reached its property limit.'});
   const data=change(saved.data,{action:'property',name:calculated.details.location.slice(0,100),phone:'',notes:''});
   const property=data.properties.at(-1);
   property.cleaningQuote={requestId:id,createdBy:user.id,createdAt:new Date().toISOString(),quote:calculated};
   if(await store.save(owner,saved.revision,data))return res.status(201).json(result(property));
  }
  return res.status(409).json({error:'Your workspace changed. Please try saving again.'});
 }catch(error){return res.status(error instanceof QuoteInputError?400:503).json({error:error instanceof QuoteInputError?error.message:'We couldn’t save your quote. Your details are still here; please try again.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
