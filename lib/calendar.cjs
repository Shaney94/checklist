const ICAL = require('ical.js');
const zone = 'Europe/London';
function wallTime(property) {
  if (!property) throw new Error('Missing booking date');
  const t = property.getFirstValue();
  if (!t || !t.year || !t.month || !t.day) throw new Error('Invalid booking date');
  const tz = property.getParameter('tzid');
  if (tz && tz !== zone) throw new Error('Unsupported time zone');
  if (t.zone?.tzid === 'UTC' && !t.isDate) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(t.toJSDate()).map(p=>[p.type,p.value]));
    return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
  }
  return {date:`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`,time:t.isDate ? null : `${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}`};
}
function parseCalendar(text) {
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== 'vcalendar') throw new Error('Invalid calendar');
  const bookings = [];
  for(const event of root.getAllSubcomponents('vevent')) {
    if (String(event.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED') continue;
    if (['rrule','rdate','recurrence-id'].some(name=>event.hasProperty(name))) throw new Error('Recurring feed requires original calendar');
    const summary = String(event.getFirstPropertyValue('summary') || '');
    // Only confirmed reservation records identify a guest checkout in this feed.
    if (!/\bReserved\s*:/i.test(summary)) {
      if (/\b(blocked|unavailable)\b/i.test(summary)) continue;
      throw new Error('Unrecognised event requires original calendar');
    }
    const arrival = wallTime(event.getFirstProperty('dtstart'));
    const checkout = wallTime(event.getFirstProperty('dtend'));
    if (checkout.date < arrival.date) throw new Error('Invalid booking range');
    bookings.push({id:String(event.getFirstPropertyValue('uid') || bookings.length),property:'Anniesland',arrival,checkout});
  }
  return {property:'Anniesland',timeZone:zone,bookings:bookings.sort((a,b)=>a.checkout.date.localeCompare(b.checkout.date)),updatedAt:new Date().toISOString()};
}
module.exports = {parseCalendar};
