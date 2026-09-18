// Dependency-free JavaScript syntax lint for this static/serverless project.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const roots=['.','api','api/cron','lib','scripts','tests'];let count=0,failed=false;
for(const root of roots)for(const file of fs.readdirSync(root)){const name=path.join(root,file);if(!/\.(?:js|cjs)$/.test(file)||!fs.statSync(name).isFile())continue;const r=spawnSync(process.execPath,['--check',name],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);failed=true;}count++;}
console.log(`Syntax lint: ${count} JavaScript files checked.`);process.exitCode=failed?1:0;
