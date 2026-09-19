const fs=require('node:fs');const {database}=require('../lib/calendar-store.cjs');
(async()=>{
 const db=database();
 const statements=fs.readFileSync('migrations/007-clean-completion.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean);
 await db.transaction(statements.map(sql=>db.query(sql)));
 const columns=await db`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='turnli_cleaning_job_photos'`;
 if(!['uploaded_by','bytes','sha256','width','height'].every(name=>columns.some(c=>c.column_name===name)))throw Error('Unexpected photo schema');
 const links=await db`SELECT 1 FROM pg_constraint WHERE conrelid='turnli_cleaning_job_photos'::regclass AND confrelid='turnli_cleaning_jobs'::regclass AND contype='f'`;
 if(!links.length)throw Error('Unexpected photo ownership');
 console.log('Clean completion schema ready.');
})().catch(()=>{console.error('Clean completion migration failed. Check database connectivity and migration permissions.');process.exitCode=1;});
