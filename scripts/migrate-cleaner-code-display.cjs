const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database(),sql=fs.readFileSync('migrations/012-cleaner-code-display.sql','utf8');
 await db.transaction([db.query(sql)]);
 console.log('Encrypted Cleaner code display ready; existing codes and assignments unchanged.');
})().catch(()=>{console.error('Cleaner code display migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
