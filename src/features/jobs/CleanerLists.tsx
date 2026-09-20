'use client';
import { useState } from 'react';
import { templates } from '../../../lib/checklist-templates.cjs';
import type { Job } from './types';
export type CleanerProperty={id:string;name:string;source:'assigned'|'customer';regular:string[];deep:string[];notApplicable?:{regular?:number[];deep?:number[]};assignmentId?:string;jobId?:string};
export function GeneralFAQs(){return <section className="section job-workspace"><h2>FAQs</h2>
 <details><summary>How do I receive work from a Host?</summary><p>Sign in using the email your Host invited, then accept the invitation in Assigned work. Its linked reservation calendar appears automatically. You do not need the Host’s iCal URL.</p></details>
 <details><summary>Can I manage my own customers?</summary><p>Use My customers to add a property and connect its calendar. These properties stay separate from work assigned by Turnli Hosts.</p></details>
 <details><summary>Where are cleaning tasks and access instructions?</summary><p>Inspect Turnli standard lists at any time. Choose an authorised property for its applicable tasks. Start Guide holds private operational instructions; access depends on your assignment.</p></details>
 <details><summary>How do I complete an assigned clean?</summary><p>Open the cleaning job, finish its saved checklist, select Complete clean and upload 3–6 photos. Review and submit for Host review. Report an issue separately when needed.</p></details>
 <details><summary>Does scheduled checkout mean I can enter?</summary><p>No. Reservation checkout is a planning time, not proof that guests have left. Confirm access using your agreed arrangements.</p></details>
 </section>}
export default function CleanerLists({kind,properties,names,jobs,onJob,status}:{kind:'regular'|'deep';properties:CleanerProperty[];names:Record<string,string>;jobs:Job[];onJob:(id:string)=>void;status:string}){
 const [selected,setSelected]=useState('');const property=properties.find(p=>p.id===selected);
 const tasks=property?property[kind]:templates[kind],excluded=property?.notApplicable?.[kind]||[];
 return <section className="section job-workspace"><h2>{kind==='regular'?'Regular':'Deep'} Clean List</h2>
 <label className="field">Choose property<select value={property?.id||''} onChange={e=>setSelected(e.target.value)}><option value="">Turnli standard</option>{properties.map(p=><option key={p.id} value={p.id}>{names[p.id]||p.name} · {p.source==='assigned'?'Assigned work':'My customers'}</option>)}</select></label>
 <p>Choose a property to see its cleaning tasks and guidance.</p><p role="status">{status}</p>
 <h3>{property?'Property-specific clean · '+(names[property.id]||property.name):'Turnli standard'}</h3><p>{tasks.length-excluded.length} applicable tasks{property?' · Reference list. Complete work in the cleaning job.':' · Inspect the standard expectations before accepting work.'}</p>
 <ul className="cleaner-reference-list">{tasks.map((task:string,i:number)=><li key={i}>{task}{excluded.includes(i)&&<strong> — Not applicable</strong>}</li>)}</ul>
 {property&&jobs.filter(j=>j.propertyId===property.id&&j.kind===kind&&j.state==='scheduled').map(j=><p key={j.id}><button className="primary" onClick={()=>onJob(j.id)}>Open cleaning job · {j.date}</button></p>)}
 </section>;
}
