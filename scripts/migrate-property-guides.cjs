const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{await database().query(fs.readFileSync('migrations/004-property-guides.sql','utf8'));console.log('Property guide schema ready.');})().catch(()=>{console.error('Property guide migration failed.');process.exitCode=1;});
