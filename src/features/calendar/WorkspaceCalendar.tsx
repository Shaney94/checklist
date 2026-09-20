"use client";
import { useEffect, useState } from 'react';
import { useCalendar } from "../calendar/useCalendar";
import CleaningCalendar from "../calendar/CleaningCalendar";
import { Icon } from "../dashboard/Sidebar";
export default function WorkspaceCalendar({ customerView=false, names={}, hiddenProperties=[] }: { customerView?: boolean; names?:Record<string,string>; hiddenProperties?:string[] }) {
 const calendar=useCalendar(undefined,customerView);
 return customerView?<CleanerCalendar own={calendar} names={names} hidden={hiddenProperties}/>:<CalendarView calendar={calendar}/>;
}
function CalendarView({calendar}:{calendar:ReturnType<typeof useCalendar>}){
 const canExport=calendar.loaded&&calendar.calendars.length>0&&(!!calendar.selected||calendar.calendars.length===1);
 return <><p>Reservations are stays, separate from cleaning jobs. Scheduled checkout does not confirm physical checkout.</p>
 {canExport&&<div className="dialog-actions"><button className="back" onClick={()=>void calendar.download()}><Icon name="add"/> Download Calendar</button><button className="back" onClick={()=>void calendar.copy()}>{calendar.copied?'Copied!':'Copy iCal Link'}</button></div>}
 <CleaningCalendar model={calendar} content={null}/></>;
}
function CleanerCalendar({own,names,hidden}:{hidden:string[];own:ReturnType<typeof useCalendar>;names:Record<string,string>}){
 const assigned=useCalendar('all');
 const [property,setProperty]=useState('');
 useEffect(()=>{assigned.setMonth(own.month);},[own.month,assigned.setMonth]);
 const bookings=[...own.bookings,...(assigned.month===own.month&&assigned.connected?assigned.bookings:[])].filter(b=>!hidden.includes(b.propertyId||'')&&(!property||b.propertyId===property)).map(b=>({...b,property:names[b.propertyId||'']||b.property}));
 const merged={...own,bookings,calendars:[],connected:own.connected||assigned.connected,loaded:own.loaded||assigned.loaded,hasCalendar:own.hasCalendar||assigned.hasCalendar,status:[!own.loaded||!own.connected?own.status:'',!assigned.connected?assigned.status:''].filter(Boolean).join(' ')};
 return <><p>Assigned work and My customers · Host calendars are read-only. Manage your own properties and feeds in My customers.</p>
 {!merged.hasCalendar&&merged.loaded&&<p>No linked calendars yet. A Host’s linked calendar appears after you accept their property invitation. Connect your own customer calendars in My customers.</p>}
 <label className="field">Calendar property<select value={property} onChange={e=>setProperty(e.target.value)}><option value="">All properties</option>{Object.entries(names).filter(([id])=>!hidden.includes(id)).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <CleaningCalendar model={merged} content={null} readOnly />
 </>;
}
