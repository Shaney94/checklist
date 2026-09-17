const {mkdirSync,copyFileSync,cpSync}=require('node:fs');
mkdirSync('public',{recursive:true});
for(const file of ['index.html','calendar.js','account.js','manifest.webmanifest','sw.js','robots.txt']) copyFileSync(file,'public/'+file);
cpSync('icons','public/icons',{recursive:true});
