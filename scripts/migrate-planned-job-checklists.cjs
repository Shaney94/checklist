const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database(),sql=fs.readFileSync('migrations/011-planned-job-checklists.sql','utf8');
 // Function bodies contain semicolons. Keep those blocks intact; ordinary DDL
 // follows the repository's statement-per-query transaction workflow.
 const statements=sql.split('-- statement-breakpoint').flatMap(s=>s.includes('$$')?[s.trim()]:s.split(';').map(x=>x.trim()).filter(Boolean));
 await db.transaction(statements.map(s=>db.query(s)));
 console.log('Planned-job checklist safeguards ready; no checklist snapshots refreshed.');
})().catch(()=>{console.error('Planned-job checklist migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
