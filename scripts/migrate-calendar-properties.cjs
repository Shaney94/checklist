const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database();
 const statements=fs.readFileSync('migrations/006-calendar-properties.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean);
 await db.transaction(statements.map(sql=>db.query(sql)));
 console.log('Calendar property schema ready.');
})().catch(()=>{console.error('Calendar property migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
