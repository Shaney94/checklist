// Restore the editable dashboard from the encrypted, versioned source.
const fs=require('node:fs');
const {decryptDashboard}=require('../lib/private-content.cjs');
if(fs.existsSync('.private/dashboard.html'))throw Error('Private source already exists; preserve or move it before restoring.');
const html=decryptDashboard(JSON.parse(fs.readFileSync('private/dashboard.enc','utf8')),process.env.TURNLI_CONTENT_KEY);
fs.mkdirSync('.private',{recursive:true,mode:0o700});
fs.writeFileSync('.private/dashboard.html',html,{mode:0o600});
console.log('Restored ignored private dashboard source.');
