const {can,dashboardPermission,managedWorkspace}=require('../../../lib/authorization.cjs');
const {createStore:createUIStore}=require('../../../lib/workspace-ui-store.cjs');
const {randomUUID}=require('node:crypto');
const {currentUser,privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {createStore}=require('../../../lib/dashboard-store.cjs');
function text(v,max,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Invalid field');return v.trim();}
function change(data,b){
 const next=structuredClone(data);
 if(b.action==='legacy-progress'){
  if(!['regular','deep'].includes(b.kind)||!b.state||!Array.isArray(b.state.checked)||b.state.checked.length>300||b.state.checked.some(v=>typeof v!=='boolean'))throw Error('Invalid progress');
  const progress={checked:b.state.checked};
  next.legacyProgress||={};next.legacyProgress[b.kind]=progress;return next;
 }
 let p=next.properties.find(p=>p.id===b.id);
 if(b.action==='property'){
  const name=text(b.name,100,true),phone=text(b.phone,30),notes=text(b.notes,3000);
  if(phone&&!/^\+?[\d ()-]{7,30}$/.test(phone))throw Error('Invalid phone');
  if(b.id&&!p)throw Error('Property not found');
  if(!p){if(next.properties.length>=100)throw Error('Property limit reached');p={id:randomUUID(),regular:[],deep:[],faqs:[],checked:{regular:[],deep:[]}};next.properties.push(p);}
  Object.assign(p,{name,phone,notes});
 }else{
  if(!p)throw Error('Property not found');
  if(b.action==='content'){
   if(!['regular','deep','faqs'].includes(b.kind)||!Array.isArray(b.items)||b.items.length>200)throw Error('Invalid content');
   if(b.kind==='faqs')p.faqs=b.items.map(f=>({question:text(f.question,300,true),answer:text(f.answer,3000,true)}));
   else{p[b.kind]=b.items.map(i=>text(i,500,true));p.checked[b.kind]=[];}
  }else if(b.action==='check'){
   if(!['regular','deep'].includes(b.kind)||!Number.isInteger(b.index)||!p[b.kind][b.index]||typeof b.checked!=='boolean')throw Error('Invalid task');
   const checked=new Set(p.checked[b.kind]);b.checked?checked.add(b.index):checked.delete(b.index);p.checked[b.kind]=[...checked];
  }else if(b.action==='reset'){
   if(!['regular','deep'].includes(b.kind))throw Error('Invalid checklist');p.checked[b.kind]=[];
  }else throw Error('Unknown action');
 }
 return next;
}
function createHandler(authenticate=currentUser,getStore=createStore,getUIStore=createUIStore){return async(req,res)=>{
 privateHeaders(res);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});if(!can(user,req.query?.action==='preferences'||req.body?.action==='preferences'?'preferences':req.method==='GET'?'workspace.read':dashboardPermission(req.body?.action)))return res.status(403).json({error:'You do not have permission to access these workspace tools.'});
  if(req.query?.action==='preferences'||req.body?.action==='preferences'){
   if(!user.id)return res.status(403).json({error:'Account unavailable.'});
   if(req.method==='GET')return res.status(200).json(await getUIStore().preferences(user.workspaceId,user.id));
   if(typeof req.body.sidebarCollapsed!=='boolean')return res.status(400).json({error:'Invalid preference.'});
   return res.status(200).json(await getUIStore().savePreferences(user.workspaceId,user.id,req.body.sidebarCollapsed));
  }
  const owner=managedWorkspace(user);if(!owner)return res.status(403).json({error:'Workspace unavailable.'});
  const store=getStore(),saved=await store.load(owner);if(req.method==='GET'){if(!user.legacyAccess||owner!==user.workspaceId)delete saved.data.legacyProgress;if(saved.data.legacyProgress)for(const k of Object.keys(saved.data.legacyProgress))saved.data.legacyProgress[k]={checked:saved.data.legacyProgress[k].checked||[]};return res.status(200).json(saved);}
  const b=req.body;if(!b||JSON.stringify(b).length>150000||!Number.isInteger(b.revision))return res.status(400).json({error:'Invalid request.'});
  if(b.id&&!saved.data.properties.some(p=>p.id===b.id))return res.status(404).json({error:'Property not found.'});
  if(b.revision!==saved.revision)return res.status(409).json({error:'This workspace changed in another tab. Reload it before saving.'});
  if(b.action==='legacy-progress'&&(!user.legacyAccess||owner!==user.workspaceId))return res.status(403).json({error:'These checklists are not part of this workspace.'});
  let data;try{data=change(saved.data,b);}catch{return res.status(400).json({error:'Check the property and all required fields, then try again.'});}
  const updated=await store.save(owner,b.revision,data);if(!updated)return res.status(409).json({error:'This workspace changed in another tab. Reload it before saving.'});
  return res.status(200).json(updated);
 }catch{return res.status(503).json({error:'Workspace could not be saved or loaded. Please retry; your saved information has not been removed.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.change=change;
