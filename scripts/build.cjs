const {mkdirSync,copyFileSync,cpSync,rmSync}=require('node:fs');
rmSync('public',{recursive:true,force:true});
mkdirSync('public',{recursive:true});
for(const file of ['index.html','calendar.js','calendar-management.js','account.js','login.js','private-session.js','calendar.css','manifest.webmanifest','sw.js','robots.txt']) copyFileSync(file,'public/'+file);
cpSync('icons','public/icons',{recursive:true});
