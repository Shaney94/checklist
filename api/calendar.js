const {currentUser,privateHeaders,validOrigin}=require('../lib/account.cjs');
const {createStore,metadata,unseal}=require('../lib/calendar-store.cjs');
const {input,validate,syncMany}=require('../lib/calendar-sync.cjs');
const {detectSource}=require('../lib/booking-source.cjs');
const {createStore:createUIStore}=require('../lib/workspace-ui-store.cjs');
const {createHash}=require('node:crypto');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function createHandler(authenticate=currentUser,getStore=createStore,fetchFeed,getUIStore=createUIStore){return async function(req,res){
 privateHeaders(res);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
 if(req.method==='POST'&&(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json')))return res.status(403).json({error:'Please use the Turnli website.'});
 try{
  const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in to view your calendar.'});
  const owner=user.workspaceId;if(!owner)return res.status(403).json({error:'Workspace unavailable.'});const store=getStore();
  if(req.method==='GET'){
   const rows=await store.list(owner);
   if(req.query?.action==='subscription'){
    const row=req.query.id?rows.find(r=>r.id===req.query.id):rows.length===1?rows[0]:null;
    if(!row)return res.status(400).json({error:'Choose a property before copying or subscribing to its calendar.'});
    return res.status(200).json({url:unseal(row.encrypted_url,owner)});
   }
   const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(req.query?.month)?req.query.month:null;
   const selected=req.query?.id;
   if(selected&&!rows.some(r=>r.id===selected))return res.status(404).json({error:'Calendar not found.'});
   const unseen=rows.length&&user.id?await getUIStore().seen(owner,user.id,rows):new Set();
   const bookings=rows.filter(r=>r.enabled&&(!selected||r.id===selected)).flatMap(row=>row.bookings.filter(b=>!month||(b.arrival.date.slice(0,7)<=month&&b.checkout.date.slice(0,7)>=month)).map(b=>({...b,id:row.id+':'+b.id,calendarId:row.id,canContactHost:!!user.legacyAccess&&row.url_hash===createHash('sha256').update(process.env.TURNLI_ICAL_URL||'').digest('hex'),property:row.display_name,...(b.sourceEvidence?{source:b.source,sourceKey:b.sourceKey,sourceEvidence:b.sourceEvidence}:detectSource({feedURL:'https://'+row.feed_host})),isNew:unseen.has(row.id+':'+b.id),arrival:{...b.arrival,...(b.arrival.allDay?{time:String(row.check_in).slice(0,5),timeSource:'property-rule'}:{})},checkout:{...b.checkout,...(b.checkout.allDay?{time:String(row.check_out).slice(0,5),timeSource:'property-rule'}:{})}}))).sort((a,b)=>a.arrival.date.localeCompare(b.arrival.date));
   return res.status(200).json({state:rows.length?'ready':'not-connected',calendars:rows.map(metadata),bookings,automaticSync:'daily',refreshCooldownSeconds:300});
  }
  const body=req.body;if(!body||typeof body!=='object'||JSON.stringify(body).length>8192)return res.status(400).json({error:'Invalid request.'});
  if(body.action==='seen'){
   if(!user.id||!Array.isArray(body.ids)||body.ids.length>50||body.ids.some(id=>typeof id!=='string'))return res.status(400).json({error:'Invalid seen-booking request.'});
   const rows=await store.list(owner);for(const row of rows){const ids=row.bookings.filter(b=>body.ids.includes(row.id+':'+b.id)).map(b=>b.id);if(ids.length)await getUIStore().acknowledge(owner,user.id,row.id,ids);}
   return res.status(200).json({ok:true});
  }
  if(body.action==='connect'){
   let settings;try{settings=input(body);if(!settings.url)throw Error('URL required');}catch{return res.status(400).json({error:'We couldn’t read this calendar. Check the iCal URL and try again.'});}
   let bookings;try{bookings=await validate(settings,fetchFeed);}catch{return res.status(400).json({error:'We couldn’t read this calendar. Check the iCal URL and try again.'});}
   try{const row=await store.create(owner,settings,bookings);return res.status(201).json({calendar:metadata(row),message:'Calendar connected ✓'});}catch(e){if(e.code==='23505')return res.status(409).json({error:'This calendar is already connected.'});throw e;}
  }
  if(body.action==='refresh'){
   const rows=await store.list(owner);const selected=body.id?rows.filter(r=>r.id===body.id):rows;
   if(body.id&&!selected.length)return res.status(404).json({error:'Calendar not found.'});
   // One request processes a bounded page; clients can refresh larger workspaces in batches.
   const offset=Number.isInteger(body.offset)&&body.offset>=0?body.offset:0;
   const results=await syncMany(store,selected.slice(offset,offset+20),fetchFeed);
   return res.status(200).json({results,nextOffset:offset+20<selected.length?offset+20:null});
  }
  if(!uuid(body.id))return res.status(400).json({error:'Invalid calendar.'});
  const row=await store.get(owner,body.id);if(!row)return res.status(404).json({error:'Calendar not found.'});
  if(body.action==='remove'){await store.remove(owner,body.id);return res.status(200).json({removed:true});}
  if(body.action==='update'){
   let settings;try{settings=input(body);}catch(e){return res.status(400).json({error:e.message});}
   const changed=await store.update(owner,body.id,settings);if(!changed)return res.status(404).json({error:'Calendar not found.'});return res.status(200).json({calendar:metadata(changed)});
  }
  return res.status(400).json({error:'Unknown action.'});
 }catch{return res.status(503).json({error:'Calendar service is temporarily unavailable. Your saved calendars have not been removed.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
