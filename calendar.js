(() => {
  const root = document.getElementById('nativeCalendar');
  const status = document.getElementById('calendarStatus');
  const original = document.getElementById('originalCalendar');
  const dialog = document.getElementById('cleanDialog');
  const monthName = document.getElementById('calendarMonth');
  const grid = document.getElementById('calendarDays');
  const list = document.getElementById('calendarBookings');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let shownMonth = new Date(today+'T12:00:00Z');
  shownMonth.setUTCDate(1);
  let bookings = [], loaded = false, loading = false, lastLoaded = 0, returnFocus;
  function readableDate(date) { return new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')); }
  function readableTime(time) {
    if(!time) return 'Time not provided';
    const [h,m] = time.split(':').map(Number);
    return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'am':'pm'}`;
  }
  function showBooking(booking) {
    returnFocus = document.activeElement;
    document.getElementById('cleanDetailsText').textContent = `${booking.property} · ${readableDate(booking.checkout.date)}. Checkout: ${readableTime(booking.checkout.time)}${booking.checkout.time?' (UK time)':''}.`;
    const nextArrival = bookings.find(item=>item.arrival.date === booking.checkout.date);
    document.getElementById('cleanTimingNote').textContent = nextArrival ? `Next guest arrives the same day${nextArrival.arrival.time?' at '+readableTime(nextArrival.arrival.time):''}. Confirm your cleaning time with the host.` : 'A turnover is due after this guest checkout. Confirm your cleaning time with the host.';
    document.getElementById('cantMakeConfirmation').hidden = true;
    document.getElementById('cantMakeButton').hidden = false;
    document.getElementById('cleanWhatsApp').href = hostMessageURL(`Hi, I’m unable to make the clean at ${booking.property} after checkout on ${readableDate(booking.checkout.date)}${booking.checkout.time?' at '+readableTime(booking.checkout.time)+' (UK time)':''}. I wanted to let you know as soon as possible so alternative cover can be arranged.`);
    dialog.showModal();
  }
  function render() {
    const year=shownMonth.getUTCFullYear(), month=shownMonth.getUTCMonth();
    monthName.textContent = new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(shownMonth);
    grid.replaceChildren(); list.replaceChildren();
    const prefix = `${year}-${String(month+1).padStart(2,'0')}-`;
    const offset = (shownMonth.getUTCDay()+6)%7;
    for(let i=0;i<offset;i++) { const blank=document.createElement('span'); blank.setAttribute('aria-hidden','true'); grid.append(blank); }
    const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    for(let day=1;day<=days;day++) {
      const date=prefix+String(day).padStart(2,'0');
      const records=bookings.filter(item=>item.checkout.date===date);
      const el=document.createElement(records.length?'button':'span'); el.className='calendar-day';
      el.textContent=String(day);
      if(date===today) { el.classList.add('is-today'); el.setAttribute('aria-current','date'); }
      if(records.length) {
        el.type='button'; el.classList.add('has-clean');
        el.setAttribute('aria-label',`${readableDate(date)}: ${records.length} turnover${records.length===1?'':'s'} after checkout`);
        const dot=document.createElement('span'); dot.textContent='Clean'; dot.className='day-label'; el.append(dot);
        el.addEventListener('click',()=>{
          if(records.length===1) showBooking(records[0]);
          else { list.querySelector(`[data-date="${date}"]`)?.focus(); }
        });
      }
      grid.append(el);
    }
    const records=bookings.filter(item=>item.checkout.date.startsWith(prefix));
    if(!records.length) { const p=document.createElement('p'); p.className='calendar-empty'; p.textContent='No guest checkouts listed for this month.'; list.append(p); }
    records.forEach(record=>{
      const button=document.createElement('button'); button.type='button'; button.className='booking-button'; button.dataset.date=record.checkout.date;
      const title=document.createElement('strong'); title.textContent=readableDate(record.checkout.date);
      const detail=document.createElement('span'); detail.textContent=`${record.property} · After checkout${record.checkout.time?' at '+readableTime(record.checkout.time):''}`;
      button.append(title,detail); button.addEventListener('click',()=>showBooking(record)); list.append(button);
    });
  }
  async function load() {
    if(loading) return;
    loading=true;
    document.getElementById('refreshCalendar').disabled=true;
    status.textContent='Updating booking dates…';
    try {
      const response=await fetch('/api/calendar',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error('Calendar unavailable');
      const data=await response.json();
      if(!Array.isArray(data.bookings)) throw new Error('Invalid calendar');
      bookings=data.bookings; loaded=true; lastLoaded=Date.now();
      render(); root.hidden=false;
      status.textContent='Guest checkout dates · UK time. Select a clean for details.';
    } catch {
      status.textContent=loaded?'Calendar could not refresh. Dates below may be out of date; check the original calendar.':'Booking dates could not load. Please use the original calendar below.';
      original.open=true;
    } finally { loading=false; document.getElementById('refreshCalendar').disabled=false; }
  }
  document.getElementById('previousMonth').addEventListener('click',()=>{shownMonth.setUTCMonth(shownMonth.getUTCMonth()-1);render();});
  document.getElementById('nextMonth').addEventListener('click',()=>{shownMonth.setUTCMonth(shownMonth.getUTCMonth()+1);render();});
  document.getElementById('calendarToday').addEventListener('click',()=>{shownMonth=new Date(today.slice(0,7)+'-01T12:00:00Z');render();});
  document.getElementById('refreshCalendar').addEventListener('click',load);
  document.getElementById('cantMakeButton').addEventListener('click',()=>{
    document.getElementById('cantMakeConfirmation').hidden=false;
    document.getElementById('cantMakeButton').hidden=true;
    document.getElementById('cantMakeTitle').focus();
  });
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected) returnFocus.focus();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-lastLoaded>60000) load();});
  load();
})();
