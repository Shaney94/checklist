const {parseCalendar} = require('../lib/calendar.cjs');
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  if(req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Method not allowed'}); }
  try {
    const response = await fetch('https://turncal.com/ical/2b34b367-9aa6-4df4-b407-e47e52bfeba4.ics',{signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!response.ok) throw new Error('Calendar unavailable');
    const reader = response.body.getReader();
    const chunks=[]; let size=0;
    for(;;) { const {value,done}=await reader.read(); if(done) break; size+=value.length; if(size>1048576) { await reader.cancel(); throw new Error('Calendar too large'); } chunks.push(Buffer.from(value)); }
    return res.status(200).json(parseCalendar(Buffer.concat(chunks).toString('utf8')));
  } catch { return res.status(502).json({error:'Unable to load booking dates. Please check the original calendar.'}); }
};
