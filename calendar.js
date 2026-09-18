(() => {
 const status=document.getElementById('calendarStatus'),root=document.getElementById('nativeCalendar'),original=document.getElementById('originalCalendar'),monthLabel=document.getElementById('calendarMonth'),grid=document.getElementById('calendarDays'),list=document.getElementById('calendarBookings'),dialog=document.getElementById('cleanDialog');
 const dayMS=86400000;
 const iso=d=>d.toISOString().slice(0,10),date=d=>new Date(d+'T12:00:00Z'),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const full=d=>new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeZone:'UTC'}).format(date(d));
 const short=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(date(d));
 let month=date(today().slice(0,7)+'-01'),bookings=[],busy=false,loaded=false,returnFocus;
 const time=part=>part.time||'Time not provided';
 function node(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
 function details(booking,clean=false){
  returnFocus=document.activeElement;document.getElementById('cleanDialogTitle').textContent=clean?'Turnli clean':'Reservation details';
  const area=document.getElementById('cleanDetailsText');area.replaceChildren();
  const fields=[['Property',booking.property],['Reservation',booking.title],['Check-in',full(booking.arrival.date)+' · '+time(booking.arrival)],['Checkout',full(booking.checkout.date)+' · '+time(booking.checkout)]];
  if(booking.guests)fields.push(['Guests',String(booking.guests)]);if(booking.source)fields.push(['Booking source',booking.source]);
  fields.forEach(([label,value])=>{const row=node('div');row.append(node('strong',label+': '),document.createTextNode(value));area.append(row);});
  const next=bookings.find(item=>item.id!==booking.id&&item.arrival.date===booking.checkout.date);
  document.getElementById('cleanTimingNote').textContent='Turnli clean: after checkout'+(booking.checkout.time?' at '+booking.checkout.time:'')+'. '+(next?'Next guest checks in the same day at '+time(next.arrival)+'. ':'')+'Confirm the cleaning start time with your host.'+(booking.arrival.timeSource==='property-rule'||booking.checkout.timeSource==='property-rule'?' Times marked by property rules are operational defaults, not times supplied by the all-day iCal event.':'')+' UK time.';
  document.getElementById('cantMakeConfirmation').hidden=true;document.getElementById('cantMakeButton').hidden=false;
  document.getElementById('cleanWhatsApp').href=hostMessageURL(`Hi, I’m unable to make the clean at ${booking.property} after checkout on ${full(booking.checkout.date)}${booking.checkout.time?' at '+booking.checkout.time+' (UK time)':''}. I wanted to let you know as soon as possible so alternative cover can be arranged.`);
  dialog.showModal();
 }
 function bookingButton(b){const button=node('button',null,'stay-bar');button.type='button';button.append(node('strong',b.title),node('span',short(b.arrival.date)+' '+time(b.arrival)+' → '+short(b.checkout.date)+' '+time(b.checkout)));button.title=`${b.property} · ${b.title} · Check-in ${full(b.arrival.date)} ${time(b.arrival)} · Checkout ${full(b.checkout.date)} ${time(b.checkout)}${b.guests?' · '+b.guests+' guests':''}`;button.setAttribute('aria-label',button.title);button.addEventListener('click',()=>details(b));return button;}
 function render(){
  monthLabel.textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(month);grid.replaceChildren();list.replaceChildren();
  const year=month.getUTCFullYear(),mon=month.getUTCMonth(),offset=(month.getUTCDay()+6)%7,start=new Date(month.getTime()-offset*dayMS),last=new Date(Date.UTC(year,mon+1,0,12));
  const weeks=Math.ceil((offset+last.getUTCDate())/7);
  for(let w=0;w<weeks;w++){
    const ws=new Date(start.getTime()+w*7*dayMS),we=new Date(ws.getTime()+6*dayMS),week=node('div',null,'booking-week'),days=node('div',null,'week-dates');
    for(let i=0;i<7;i++){const d=new Date(ws.getTime()+i*dayMS),label=node('span',String(d.getUTCDate()));if(d.getUTCMonth()!==mon)label.classList.add('outside-month');if(iso(d)===today()){label.classList.add('is-today');label.setAttribute('aria-current','date');}days.append(label);}week.append(days);
    const bars=node('div',null,'week-stays'),laneEnds=[];
    bookings.filter(b=>b.arrival.date<=iso(we)&&b.checkout.date>=iso(ws)).forEach(b=>{
      const first=Math.max(0,Math.round((date(b.arrival.date)-ws)/dayMS)),end=Math.min(6,Math.round((date(b.checkout.date)-ws)/dayMS));
      let lane=laneEnds.findIndex(n=>n<first);if(lane===-1)lane=laneEnds.length;laneEnds[lane]=end;
      const bar=bookingButton(b);bar.style.gridColumn=`${first+1} / ${end+2}`;bar.style.gridRow=String(lane+1);if(first===end)bar.classList.add('short-stay');bars.append(bar);
    });week.append(bars);
    const cleans=node('div',null,'week-cleans');
    bookings.filter(b=>b.checkout.date>=iso(ws)&&b.checkout.date<=iso(we)).forEach(b=>{const clean=node('button','Clean after '+time(b.checkout),'clean-marker');clean.type='button';clean.style.gridColumn=String(Math.round((date(b.checkout.date)-ws)/dayMS)+1);clean.setAttribute('aria-label',`Turnli clean after checkout on ${full(b.checkout.date)} at ${time(b.checkout)}`);clean.addEventListener('click',()=>details(b,true));cleans.append(clean);});week.append(cleans);grid.append(week);
  }
  const prefix=iso(month).slice(0,7),visible=bookings.filter(b=>b.arrival.date.slice(0,7)<=prefix&&b.checkout.date.slice(0,7)>=prefix);
  if(!visible.length){list.append(node('p',bookings.some(b=>b.checkout.date>=today())?'No stays this month.':'No upcoming stays.','calendar-empty'));}
  visible.forEach(b=>{
    const stay=node('button',null,'timeline-stay');stay.type='button';stay.append(node('strong',b.title),node('span',b.property+(b.guests?' · '+b.guests+' guests':'')),node('span','Check-in '+short(b.arrival.date)+' · '+time(b.arrival)),node('span','Checkout '+short(b.checkout.date)+' · '+time(b.checkout)));stay.addEventListener('click',()=>details(b));list.append(stay);
    const clean=node('button',null,'timeline-clean');clean.type='button';clean.append(node('strong','Turnli clean'),node('span',short(b.checkout.date)+' · After checkout'+(b.checkout.time?' at '+b.checkout.time:'')));clean.addEventListener('click',()=>details(b,true));list.append(clean);
  });
 }
 async function load(){if(busy)return;busy=true;document.getElementById('refreshCalendar').disabled=true;document.getElementById('calendarSkeleton').hidden=loaded;root.setAttribute('aria-busy','true');status.textContent='Loading your booking calendar…';
  try{const response=await fetch('/api/calendar',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(response.status===401){location.replace('/?next='+encodeURIComponent('/app'+location.hash));return;}const data=await response.json();if(!response.ok)throw Error('refresh');if(data.state==='not-connected'){status.textContent='Connect your booking calendar to see upcoming stays and automatically schedule cleans.';root.hidden=true;return;}if(!Array.isArray(data.bookings))throw Error('invalid');bookings=data.bookings;loaded=true;document.getElementById('refreshCalendar').textContent='Refresh';render();root.hidden=false;status.textContent=bookings.some(b=>b.checkout.date>=today())?'Guest stays → checkout → Turnli clean. All times are UK time.':'No upcoming stays.';}
  catch{status.textContent='We couldn’t refresh your booking calendar.'+(loaded?' Previously loaded bookings may be out of date.':' Use Retry or the original calendar below.');document.getElementById('refreshCalendar').textContent='Retry';if(!loaded)original.open=true;}
  finally{busy=false;document.getElementById('calendarSkeleton').hidden=true;root.setAttribute('aria-busy','false');document.getElementById('refreshCalendar').disabled=false;}
 }
 document.getElementById('previousMonth').addEventListener('click',()=>{month.setUTCMonth(month.getUTCMonth()-1);render();});document.getElementById('nextMonth').addEventListener('click',()=>{month.setUTCMonth(month.getUTCMonth()+1);render();});document.getElementById('calendarToday').addEventListener('click',()=>{month=date(today().slice(0,7)+'-01');render();});document.getElementById('refreshCalendar').addEventListener('click',load);
 document.getElementById('cantMakeButton').addEventListener('click',()=>{document.getElementById('cantMakeConfirmation').hidden=false;document.getElementById('cantMakeButton').hidden=true;document.getElementById('cantMakeTitle').focus();});dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
 let subscriptionUrl='';
 async function subscription(){if(subscriptionUrl)return subscriptionUrl;const r=await fetch('/api/calendar?action=subscription',{cache:'no-store',credentials:'same-origin'});if(r.status===401){location.replace('/?next=%2Fapp');throw Error('Please log in again.');}const data=await r.json();if(!r.ok||!data.url)throw Error('Calendar subscription is unavailable.');subscriptionUrl=data.url;return subscriptionUrl;}
 document.getElementById('subscribeCalendar').addEventListener('click',async()=>{try{location.assign(await subscription());}catch(e){status.textContent=e.message;}});
 document.getElementById('copyCalendar').addEventListener('click',async event=>{const b=event.currentTarget;try{if(!subscriptionUrl){await subscription();status.textContent='Calendar link ready. Tap Copy iCal Link again to copy it.';return;}await navigator.clipboard.writeText(subscriptionUrl);b.querySelector('[data-copy-label]').textContent='Copied!';clearTimeout(b.copyResetTimer);b.copyResetTimer=setTimeout(()=>b.querySelector('[data-copy-label]').textContent='Copy iCal Link',2500);}catch{status.textContent='We couldn’t copy the calendar link. Please try again.';}});
 subscription().catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});load();
})();
