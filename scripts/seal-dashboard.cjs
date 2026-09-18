// Edit .private/dashboard.html locally, then seal it before committing.
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const key=Buffer.from(process.env.TURNLI_CONTENT_KEY||'','base64');if(key.length!==32)throw Error('TURNLI_CONTENT_KEY must be configured in the server environment');
const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
const content=Buffer.concat([cipher.update(zlib.gzipSync(fs.readFileSync('.private/dashboard.html'))),cipher.final()]);
fs.mkdirSync('private',{recursive:true});fs.writeFileSync('private/dashboard.enc',JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),content:content.toString('base64')})+'\n');
console.log('Private dashboard encrypted. No plaintext operational data included in public assets.');
