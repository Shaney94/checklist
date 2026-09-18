const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{await database().query(fs.readFileSync('migrations/002-dashboard.sql','utf8'));console.log('Workspace dashboard schema ready.');})().catch(()=>{console.error('Dashboard migration failed.');process.exitCode=1;});
