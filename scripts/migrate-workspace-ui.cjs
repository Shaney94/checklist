const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{for(const q of fs.readFileSync('migrations/003-workspace-ui.sql','utf8').split(';').filter(q=>q.trim()))await database().query(q);console.log('Workspace UI schema ready.');})().catch(()=>{console.error('Workspace UI migration failed.');process.exitCode=1;});
