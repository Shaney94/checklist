const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database(),sql=fs.readFileSync('migrations/010-turnover-reservation-state.sql','utf8');
 // Function bodies contain semicolons. Keep those blocks intact; ordinary DDL
 // follows the repository's statement-per-query transaction workflow.
 const statements=sql.split('-- statement-breakpoint').flatMap(s=>s.includes('$$')?[s.trim()]:s.split(';').map(x=>x.trim()).filter(Boolean));
 await db.transaction(statements.map(s=>db.query(s)));
 console.log('Turnover reservation-state migration ready; no existing jobs rewritten.');
})().catch(()=>{console.error('Turnover reservation-state migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
