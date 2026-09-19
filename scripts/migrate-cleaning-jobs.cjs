const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database();
 const statements=fs.readFileSync('migrations/005-cleaning-jobs.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean);
 await db.transaction(statements.map(sql=>db.query(sql)));
 console.log('Cleaning job schema ready.');
})().catch(()=>{console.error('Cleaning job migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
