(() => {
 const status=document.getElementById('calendarStatus'),root=document.getElementById('nativeCalendar'),original=document.getElementById('originalCalendar'),monthLabel=document.getElementById('calendarMonth'),grid=document.getElementById('calendarDays'),list=document.getElementById('calendarBookings'),dialog=document.getElementById('cleanDialog');
 const dayMS=86400000;
 const iso=d=>d.toISOString().slice(0,10),date=d=>new Date(d+'T12:00:00Z'),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const full=d=>new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeZone:'UTC'}).format(date(d));
 const short=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(date(d));
 let calendars=[],selected='',explicitAll=false;
 let month=date(today().slice(0,7)+'-01'),bookings=[],busy=false,loaded=false,returnFocus;
 const time=part=>part.time||'Time not provided';
 function node(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
 function details(booking,clean=false){
  returnFocus=document.activeElement;document.getElementById('cleanDialogTitle').textContent=clean?'Turnli clean':'Reservation details';
  const area=document.getElementById('cleanDetailsText');area.replaceChildren();
  const fields=[['Property',booking.property],['Check-in',full(booking.arrival.date)+' · '+time(booking.arrival)],['Checkout',full(booking.checkout.date)+' · '+time(booking.checkout)]];
  if(booking.guests)fields.push(['Guests',String(booking.guests)]);if(booking.source)fields.push(['Booking source',booking.source]);
  fields.forEach(([label,value])=>{const row=node('div');row.append(node('strong',label+': '),document.createTextNode(value));area.append(row);});
  document.getElementById('cleanTimingNote').textContent=(booking.arrival.timeSource==='property-rule'||booking.checkout.timeSource==='property-rule')?'Times use this property’s check-in/checkout settings because the iCal feed supplies dates only. UK time.':'All times are UK time.';
  document.getElementById('cantMakeConfirmation').hidden=true;document.getElementById('cantMakeButton').hidden=!booking.canContactHost||typeof hostMessageURL!=='function';
  if(booking.canContactHost&&typeof hostMessageURL==='function')document.getElementById('cleanWhatsApp').href=hostMessageURL(`Hi, I’m unable to make the clean at ${booking.property} after checkout on ${full(booking.checkout.date)}${booking.checkout.time?' at '+booking.checkout.time+' (UK time)':''}. I wanted to let you know as soon as possible so alternative cover can be arranged.`);
  dialog.showModal();
 }
 function bookingLabel(b){return `${b.property} · ${b.source||'Reservation'} · Check-in ${full(b.arrival.date)} ${time(b.arrival)} · Check-out ${full(b.checkout.date)} ${time(b.checkout)}${b.guests?' · '+b.guests+' guests':''}`;}
 function decorateBooking(button,b){button.type='button';button.dataset.bookingId=b.id;button.dataset.source=b.sourceKey||'unknown';button.title=bookingLabel(b);button.setAttribute('aria-label',button.title+(b.isNew?' · New booking':''));button.addEventListener('click',()=>details(b));if(b.isNew)button.dataset.newBooking='true';}
 function bookingButton(segment){
  const {booking:b,continuesBefore,continuesAfter}=segment,container=node('div',null,'stay-container'),button=node('button',null,'stay-bar');decorateBooking(button,b);
  if(continuesBefore)button.classList.add('continues-before');if(continuesAfter)button.classList.add('continues-after');
  const normal=node('span',null,'stay-normal');
  const start=node('span',null,'stay-start');if(continuesBefore)start.append(node('span','←','continuation-arrow'));else{start.append(document.createTextNode(b.arrival.time||'—'),node('span',' Check-in','time-caption'));}
  const end=node('span',null,'stay-end');if(continuesAfter)end.append(node('span','→','continuation-arrow'));else{end.append(document.createTextNode(b.checkout.time||'—'),node('span',' Check-out','time-caption'));}
  normal.append(start,node('span',b.guests?b.guests+' guests':'Reserved','stay-guests'),end);button.append(normal,node('span','New booking','new-booking-label'));
  if(continuesBefore||continuesAfter){const arrows=node('span',(continuesBefore?'← ':'')+(continuesAfter?' →':''),'narrow-continuation');arrows.setAttribute('aria-hidden','true');button.append(arrows);}
  container.append(button);container.style.gridColumn=`${segment.first+1} / ${segment.last+1}`;container.style.gridRow=String(segment.lane+1);return container;
 }
 function render(){
  monthLabel.textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(month);grid.replaceChildren();list.replaceChildren();
  const year=month.getUTCFullYear(),mon=month.getUTCMonth(),offset=(month.getUTCDay()+6)%7,start=new Date(month.getTime()-offset*dayMS),last=new Date(Date.UTC(year,mon+1,0,12));
  const weeks=Math.ceil((offset+last.getUTCDate())/7),desktop=node('div',null,'desktop-month'),mobile=node('div',null,'mobile-month');
  for(let w=0;w<weeks;w++){
   const ws=new Date(start.getTime()+w*7*dayMS),week=node('div',null,'booking-week'),days=node('div',null,'week-dates');
   for(let i=0;i<7;i++){
    const d=new Date(ws.getTime()+i*dayMS),key=iso(d),label=node('span',String(d.getUTCDate()));if(d.getUTCMonth()!==mon)label.classList.add('outside-month');if(key===today()){label.classList.add('is-today');label.setAttribute('aria-current','date');}days.append(label);
    const cell=node('div',null,'month-cell');cell.setAttribute('aria-label',full(key));cell.append(label.cloneNode(true));if(d.getUTCMonth()!==mon)cell.classList.add('outside-month');
    for(const b of bookings.filter(b=>b.arrival.date<=key&&b.checkout.date>=key)){
     const chip=node('button',null,'mobile-booking');decorateBooking(chip,b);if(b.arrival.date<key)chip.classList.add('continues-before');if(b.checkout.date>key)chip.classList.add('continues-after');const abbrev={airbnb:'Air',booking:'B.c',vrbo:'Vrbo',houfy:'Houfy',unknown:'Stay'}[b.sourceKey||'unknown']||'Stay';
     chip.append(node('span',abbrev,'mobile-source'));if(b.guests)chip.append(node('span',String(b.guests)+' ppl','mobile-guests'));if(b.isNew)chip.append(node('span','New booking','mobile-new'));cell.append(chip);
    }mobile.append(cell);
   }week.append(days);const bars=node('div',null,'week-stays');TurnliCalendarLayout.segments(bookings,iso(ws)).forEach(segment=>bars.append(bookingButton(segment)));week.append(bars);desktop.append(week);
  }grid.append(desktop,mobile);
 }
 async function acknowledgeNew(){
  const visible=bookings.filter(b=>b.isNew),ids=visible.map(b=>b.id);if(!ids.length)return;
  try{for(let i=0;i<ids.length;i+=50){const response=await fetch('/api/calendar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'seen',ids:ids.slice(i,i+50)})});if(!response.ok)throw Error();}
   for(const button of grid.querySelectorAll('[data-new-booking]'))button.classList.add('booking-new');
   setTimeout(()=>{for(const button of grid.querySelectorAll('.booking-new')){button.classList.remove('booking-new');button.removeAttribute('data-new-booking');button.querySelector('.mobile-new')?.remove();}for(const b of visible)b.isNew=false;},6200);
  }catch{status.textContent+=' New-booking markers could not be saved; they will be retried when the calendar reloads.';}
 }

 async function load(){if(busy)return;busy=true;document.getElementById('refreshCalendar').disabled=true;document.getElementById('calendarSkeleton').hidden=loaded;root.setAttribute('aria-busy','true');status.textContent='Loading your booking calendar…';
  async function fetchData(){const q=new URLSearchParams({month:iso(month).slice(0,7)});if(selected)q.set('id',selected);const response=await fetch('/api/calendar?'+q,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000)});if(response.status===401){location.replace('/?next='+encodeURIComponent('/app'+location.hash));throw Error('Your session expired.');}const data=await response.json();if(!response.ok)throw Error(data.error||'We couldn’t refresh your booking calendar.');return data;}
  try{let data=await fetchData();calendars=data.calendars||[];
   if(calendars.length>10&&!selected&&!explicitAll){selected=calendars[0].id;data=await fetchData();}
   document.dispatchEvent(new CustomEvent('turnli:calendars',{detail:{calendars,selected}}));
   if(data.state==='not-connected'){bookings=[];loaded=true;status.textContent='Connect your booking calendar to see upcoming stays and automatically schedule cleans.';root.hidden=true;return;}
   if(!Array.isArray(data.bookings))throw Error('Invalid calendar response');bookings=data.bookings;loaded=true;render();root.hidden=false;
   const errors=calendars.filter(c=>c.error&&(!selected||c.id===selected));status.textContent=errors.length?'Some calendars could not sync. Previously saved bookings are shown; check Manage calendars.':bookings.length?'Guest stays → checkout → Turnli clean. All times are UK time.':'No stays this month.';
   await acknowledgeNew();
  }catch(e){status.textContent=e.message+(loaded?' Previously loaded bookings may be out of date.':'');if(!loaded&&!original.hidden)original.open=true;}
  finally{busy=false;document.getElementById('calendarSkeleton').hidden=true;root.setAttribute('aria-busy','false');document.getElementById('refreshCalendar').disabled=false;}
 }
 document.getElementById('previousMonth').addEventListener('click',()=>{if(busy)return;month.setUTCMonth(month.getUTCMonth()-1);load();});document.getElementById('nextMonth').addEventListener('click',()=>{if(busy)return;month.setUTCMonth(month.getUTCMonth()+1);load();});document.getElementById('calendarToday').addEventListener('click',()=>{if(busy)return;month=date(today().slice(0,7)+'-01');load();});document.getElementById('refreshCalendar').addEventListener('click',()=>document.dispatchEvent(new CustomEvent('turnli:refresh',{detail:{id:selected||undefined}})));
 document.addEventListener('turnli:reload',event=>{subscriptionUrl='';if(event.detail?.removed===selected)selected='';load();});
 document.addEventListener('turnli:filter',event=>{selected=event.detail.id;explicitAll=!selected;subscriptionUrl='';load();});
 document.getElementById('cantMakeButton').addEventListener('click',()=>{document.getElementById('cantMakeConfirmation').hidden=false;document.getElementById('cantMakeButton').hidden=true;document.getElementById('cantMakeTitle').focus();});dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
 let subscriptionUrl='';
 async function subscription(){if(subscriptionUrl)return subscriptionUrl;const r=await fetch('/api/calendar?'+new URLSearchParams({action:'subscription',...(selected?{id:selected}:{})}),{cache:'no-store',credentials:'same-origin'});if(r.status===401){location.replace('/?next=%2Fapp');throw Error('Please log in again.');}const data=await r.json();if(!r.ok||!data.url)throw Error(data.error||'Calendar subscription is unavailable.');subscriptionUrl=data.url;return subscriptionUrl;}
 document.getElementById('subscribeCalendar').addEventListener('click',async()=>{try{location.assign(await subscription());}catch(e){status.textContent=e.message;}});
 document.getElementById('copyCalendar').addEventListener('click',async event=>{const b=event.currentTarget;if(calendars.length>1&&!selected){status.textContent='Choose a property before copying its calendar link.';return;}try{
  if(typeof ClipboardItem==='function'&&navigator.clipboard?.write){await navigator.clipboard.write([new ClipboardItem({'text/plain':subscription().then(url=>new Blob([url],{type:'text/plain'}))})]);}
  else await navigator.clipboard.writeText(await subscription());
  b.querySelector('[data-copy-label]').textContent='Copied!';clearTimeout(b.copyResetTimer);b.copyResetTimer=setTimeout(()=>b.querySelector('[data-copy-label]').textContent='Copy iCal Link',2500);
 }catch(e){status.textContent=e.message||'We couldn’t copy the calendar link. Please try again.';}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});load();
})();
