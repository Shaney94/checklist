const {timingSafeEqual}=require('node:crypto');
const {createStore}=require('../../lib/calendar-store.cjs');
const {syncMany}=require('../../lib/calendar-sync.cjs');
const {privateHeaders}=require('../../lib/account.cjs');
function createHandler(getStore=createStore,fetchFeed){return async(req,res)=>{
 privateHeaders(res);
 if(req.method!=='GET')return res.status(405).end();
 const secret=process.env.CRON_SECRET,actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+secret);
 if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).json({error:'Unauthorized'});
 try{const store=getStore(),deadline=Date.now()+230000;let synced=0,failed=0;
  while(Date.now()<deadline){const rows=await store.due(20);if(!rows.length)break;const results=await syncMany(store,rows,fetchFeed);synced+=results.filter(r=>r.ok).length;failed+=results.filter(r=>r.ok===false).length;if(results.every(r=>r.skipped))break;}
  return res.status(200).json({synced,failed});
 }catch{return res.status(503).json({error:'Calendar sync could not finish.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
