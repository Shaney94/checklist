const {parseCalendar}=require('../lib/calendar.cjs');
const {currentUser,privateHeaders}=require('../lib/account.cjs');
function createHandler(authenticate=currentUser,fetchFeed=fetch){return async function handler(req,res){
 privateHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 try {
  if(!await authenticate(req,res))return res.status(401).json({error:'Please log in to view your calendar.'});
  const url=process.env.TURNLI_ICAL_URL;if(!url)return res.status(200).json({state:'not-connected',bookings:[]});
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='turncal.com'||!parsed.pathname.startsWith('/ical/'))throw Error('Invalid calendar configuration');
  if(req.query?.action==='subscription')return res.status(200).json({url});
  const response=await fetchFeed(url,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Calendar unavailable');
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw Error('Calendar too large');}chunks.push(Buffer.from(value));}
  const data=parseCalendar(Buffer.concat(chunks).toString('utf8'),{property:process.env.TURNLI_PROPERTY_NAME,checkIn:process.env.TURNLI_CHECKIN_TIME,checkOut:process.env.TURNLI_CHECKOUT_TIME});
  return res.status(200).json({state:'ready',...data});
 }catch{return res.status(502).json({state:'error',error:'We couldn’t refresh your booking calendar.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
