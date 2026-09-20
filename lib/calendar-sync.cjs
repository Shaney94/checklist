const {fetchCalendar,feedURL}=require('./feed-fetch.cjs');
const {parseCalendar}=require('./calendar.cjs');
const {unseal}=require('./calendar-store.cjs');
function input(body){
 const name=typeof body.name==='string'?body.name.trim():'';
 if(!name||name.length>100)throw Error('Enter a calendar/property name of up to 100 characters.');
 const platform=['Airbnb','Booking.com','Vrbo','Houfy','TurnCal','Custom iCal'].includes(body.platform)?body.platform:'Custom iCal';
 const checkIn=body.checkIn||'15:00',checkOut=body.checkOut||'10:00';
 if(![checkIn,checkOut].every(v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)))throw Error('Enter check-in and checkout times in HH:mm format.');
 return {name,platform,checkIn,checkOut,enabled:body.enabled!==false,...(body.url?{url:feedURL(body.url).href}:{})};
}
function snapshot(text,settings){const data=parseCalendar(text,{property:settings.name,checkIn:settings.checkIn,checkOut:settings.checkOut,feedURL:settings.url});if(data.bookings.length>5000)throw Error('Calendar too large');const unique=new Map();for(const b of data.bookings){if(unique.has(b.id)&&JSON.stringify(unique.get(b.id))!==JSON.stringify(b))throw Error('Conflicting duplicate UID');unique.set(b.id,b);}if(data.cancelledIds.some(id=>unique.has(id)))throw Error('Conflicting cancellation UID');return {bookings:[...unique.values()],cancelledIds:data.cancelledIds};}
function parse(text,settings){return snapshot(text,settings).bookings;}
async function validate(settings,fetchFeed=fetchCalendar){return parse(await fetchFeed(settings.url),settings);}
async function syncOne(store,owner,id,fetchFeed=fetchCalendar){
 const row=await store.claim(owner,id);if(!row)return {id,skipped:true};
 try{const settings={url:unseal(row.encrypted_url,owner),name:row.display_name,checkIn:String(row.check_in).slice(0,5),checkOut:String(row.check_out).slice(0,5)};const data=snapshot(await fetchFeed(settings.url),settings);await store.finish(row,data.bookings,null,data.cancelledIds);return {id,ok:true,count:data.bookings.length};}
 catch{await store.finish(row,null,'We couldn’t refresh this calendar. Check the source feed and try again.');return {id,ok:false};}
}
async function syncMany(store,rows,fetchFeed){const results=[];for(let i=0;i<rows.length;i+=5)results.push(...await Promise.all(rows.slice(i,i+5).map(r=>syncOne(store,r.owner_id,r.id,fetchFeed))));return results;}
module.exports={input,parse,snapshot,validate,syncOne,syncMany};
