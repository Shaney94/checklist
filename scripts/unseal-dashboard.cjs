// Restore the editable dashboard from the encrypted, versioned source.
const fs=require('node:fs');
const {decryptDashboard}=require('../lib/private-content.cjs');
if(fs.existsSync('.private/cleaning-content.json'))throw Error('Private source already exists; preserve or move it before restoring.');
const data=decryptDashboard(JSON.parse(fs.readFileSync('private/cleaning-content.enc','utf8')),process.env.TURNLI_CONTENT_KEY);
fs.mkdirSync('.private',{recursive:true,mode:0o700});
fs.writeFileSync('.private/cleaning-content.json',data,{mode:0o600});
console.log('Restored ignored private dashboard source.');
