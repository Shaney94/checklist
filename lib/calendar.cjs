const ICAL=require('ical.js');
const {createHash}=require('node:crypto');
const zone='Europe/London';
function wallTime(property,defaultTime) {
 if(!property)throw Error('Missing event date');
 const t=property.getFirstValue(),tz=property.getParameter('tzid');
 if(!t||!t.year||!t.month||!t.day)throw Error('Invalid event date');
 if(tz&&tz!==zone&&tz!=='UTC')throw Error('Unsupported time zone');
 if((t.zone?.tzid==='UTC'||tz==='UTC')&&!t.isDate){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(t.toJSDate()).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,timeSource:'feed',allDay:false};}
 const date=`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`;
 if(new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid date');
 return {date,time:t.isDate?(defaultTime||null):`${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}`,timeSource:t.isDate?(defaultTime?'property-rule':'not-provided'):'feed',allDay:t.isDate};
}
function parseCalendar(text,options={}) {
 const root=new ICAL.Component(ICAL.parse(text));if(root.name!=='vcalendar')throw Error('Invalid calendar');
 const property=options.property||String(root.getFirstPropertyValue('x-wr-calname')||'Property').slice(0,120),bookings=[];
 for(const event of root.getAllSubcomponents('vevent')){
  if(String(event.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED')continue;
  if(['rrule','rdate','recurrence-id'].some(name=>event.hasProperty(name)))throw Error('Recurring feed requires supported expansion');
  const summary=String(event.getFirstPropertyValue('summary')||'Reserved stay').slice(0,240);
  if(/^(blocked|unavailable)(\b|:)/i.test(summary))continue;
  const id=String(event.getFirstPropertyValue('uid')||'');if(!id)throw Error('Missing event UID');
  const arrival=wallTime(event.getFirstProperty('dtstart'),options.checkIn),checkout=wallTime(event.getFirstProperty('dtend'),options.checkOut);
  if(checkout.date<arrival.date||(checkout.date===arrival.date&&arrival.time&&checkout.time&&checkout.time<=arrival.time))throw Error('Invalid event range');
  const description=String(event.getFirstPropertyValue('description')||'');
  const guestMatch=summary.match(/\b(\d{1,3})\s*(?:guests?|people|persons?)\b/i)||description.match(/(?:^|\n)(?:number of guests|guests)\s*:\s*(\d{1,3})\b/i);
  const source=['Airbnb','Booking.com','Vrbo','Hostex'].find(name=>(summary+' '+description).toLowerCase().includes(name.toLowerCase()))||null;
  bookings.push({id:createHash('sha256').update(id).digest('hex'),property,guests:guestMatch?Number(guestMatch[1]):null,source,arrival,checkout});
 }
 return {property,timeZone:zone,bookings:bookings.sort((a,b)=>a.arrival.date.localeCompare(b.arrival.date)),updatedAt:new Date().toISOString()};
}
module.exports={parseCalendar};
