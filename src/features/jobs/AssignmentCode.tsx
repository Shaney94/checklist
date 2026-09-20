'use client';
import { useEffect, useState } from 'react';
import { request, message } from '../dashboard/api';
export default function AssignmentCode() {
 const [code,setCode]=useState(''),[legacy,setLegacy]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('Loading your private code…');
 async function load(replace=false){
  if(replace&&!confirm('Replace your assignment code? The previous code stops working. Existing property assignments and jobs stay in place.'))return;
  setBusy(true);
  try{const result=await request<{code:string|null;legacy:boolean}>('/api/cleaning-jobs',{action:replace?'replace-code':'code',...(replace?{confirm:true}:{})});setCode(result.code||'');setLegacy(result.legacy);setStatus('');}
  catch(e){setStatus(message(e));}finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 return <section className="assignment-code"><h3>Private assignment code</h3><p>Share with a Host who wants to assign you work. This code cannot sign anyone in or open a property.</p>
 {code&&<><label className="field">Your assignment code<input readOnly value={code} onFocus={e=>e.target.select()} /></label><button className="primary" onClick={async()=>{try{await navigator.clipboard.writeText(code);setStatus('Copied');}catch{setStatus('Copy could not complete. Select the code and copy it manually.');}}}>Copy code</button></>}
 {legacy&&<p>Your earlier code was stored one-way and cannot be displayed. It still works. Replace it once to get a code you can view again.</p>}
 {(code||legacy)&&<button className="back" disabled={busy} onClick={()=>void load(true)}>Replace code</button>}
 <p role="status" aria-live="polite">{status}</p>{!code&&!legacy&&!busy&&status&&<button className="back" onClick={()=>void load()}>Try again</button>}
 </section>;
}
