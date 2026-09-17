const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseCalendar}=require('../lib/calendar.cjs');
const handler=require('../api/calendar.js');
function feed(dates,extra=''){return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nSUMMARY:(annies) Reserved: Private guest\r\nDESCRIPTION:Private reservation code\r\n${dates}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR`;}
test('TurnCal London stays become checkout turnovers without guest details',()=>{
 const data=parseCalendar(feed('DTSTART;TZID=Europe/London:20260913T150000\r\nDTEND;TZID=Europe/London:20260920T100000'));
 assert.deepEqual(data.bookings[0].checkout,{date:'2026-09-20',time:'10:00'});assert(!JSON.stringify(data).includes('Private'));
});
test('UTC times use the correct UK daylight saving offset',()=>{
 assert.deepEqual(parseCalendar(feed('DTSTART:20260913T140000Z\r\nDTEND:20260920T090000Z')).bookings[0].checkout,{date:'2026-09-20',time:'10:00'});
 assert.deepEqual(parseCalendar(feed('DTSTART:20261213T150000Z\r\nDTEND:20261220T100000Z')).bookings[0].checkout,{date:'2026-12-20',time:'10:00'});
});
test('all-day checkouts do not invent a time',()=>assert.deepEqual(parseCalendar(feed('DTSTART;VALUE=DATE:20260913\r\nDTEND;VALUE=DATE:20260920')).bookings[0].checkout,{date:'2026-09-20',time:null}));
test('cancelled stays are excluded',()=>assert.equal(parseCalendar(feed('DTSTART:20260913T140000Z\r\nDTEND:20260920T090000Z','STATUS:CANCELLED\r\n')).bookings.length,0));
test('unsupported recurrence and zones require the original calendar',()=>{
 assert.throws(()=>parseCalendar(feed('DTSTART:20260913T140000Z\r\nDTEND:20260920T090000Z','RRULE:FREQ=WEEKLY\r\n')));
 assert.throws(()=>parseCalendar(feed('DTSTART;TZID=America/New_York:20260913T150000\r\nDTEND;TZID=America/New_York:20260920T100000')));
});
test('missing checkout and malformed calendar fail visibly',()=>{assert.throws(()=>parseCalendar(feed('DTSTART:20260913T140000Z')));assert.throws(()=>parseCalendar('not a calendar'));});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(data){this.data=data;return this}};}
test('calendar endpoint rejects writes',async()=>{const res=response();await handler({method:'POST'},res);assert.equal(res.code,405);assert.equal(res.headers['Cache-Control'],'no-store');});
test('upstream failures return a clear error, never empty bookings',async()=>{const original=global.fetch;global.fetch=async()=>{throw new Error('offline')};try{const res=response();await handler({method:'GET'},res);assert.equal(res.code,502);assert(res.data.error);assert(!res.data.bookings);}finally{global.fetch=original;}});
test('unrecognised event types fall back instead of hiding scheduled work',()=>{assert.throws(()=>parseCalendar(feed('DTSTART:20260913T140000Z\r\nDTEND:20260920T090000Z').replace('(annies) Reserved: Private guest','Deep clean appointment')));});
