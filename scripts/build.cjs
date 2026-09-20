const {mkdirSync,copyFileSync,cpSync,rmSync}=require('node:fs');
rmSync('public',{recursive:true,force:true});
mkdirSync('public',{recursive:true});
for(const file of ['manifest.webmanifest','sw.js']) copyFileSync(file,'public/'+file);
cpSync('icons','public/icons',{recursive:true});
