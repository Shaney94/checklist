const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database(),statements=fs.readFileSync('migrations/008-property-assignments.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean);
 await db.transaction(statements.map(sql=>db.query(sql)));
 console.log('Property assignment schema ready.');
})().catch(()=>{console.error('Property assignment migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
