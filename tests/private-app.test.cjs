const {test}=require('node:test'),assert=require('node:assert/strict');const {createHandler}=require('../src/server/handlers/bootstrap.js');
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},end(data){this.data=data;return this},json(data){this.data=data;return this}};}
test('logged-out bootstrap never loads private data',async()=>{const r=res();await createHandler(async()=>null,()=>assert.fail('private data accessed'))({method:'GET'},r);assert.equal(r.code,401);assert(r.headers['Cache-Control'].includes('no-store'));});
test('legacy workspace membership cannot expose property content without an assignment',async()=>{const r=res();await createHandler(async()=>({role:'cleaner',workspaceId:'test',legacyAccess:true}),()=>({regular:[['Test',['Task']]]}))({method:'GET'},r);assert.equal(r.code,200);assert.equal(r.data.content,null);assert.equal(r.headers.Vary,'Cookie');assert(r.headers['Cache-Control'].includes('no-store'));});
test('authentication outage never exposes private content',async()=>{const r=res();await createHandler(async()=>{throw Error('offline')},()=>assert.fail('private data accessed'))({method:'GET'},r);assert.equal(r.code,503);});
test('encrypted content rejects an incorrect key or modified content',()=>{
 const crypto=require('node:crypto'),zlib=require('node:zlib'),{decryptDashboard}=require('../lib/private-content.cjs');
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const content=Buffer.concat([cipher.update(zlib.gzipSync('synthetic private content')),cipher.final()]);
 const data={iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),content:content.toString('base64')};
 assert.equal(decryptDashboard(data,key.toString('base64')),'synthetic private content');assert.throws(()=>decryptDashboard(data,crypto.randomBytes(32).toString('base64')));
 content[0]^=1;assert.throws(()=>decryptDashboard({...data,content:content.toString('base64')},key.toString('base64')));
});
test('new workspace bootstrap contains no original-workspace data',async()=>{const r=res();await createHandler(async()=>({role:'cleaner',workspaceId:'test',legacyAccess:false,id:'new-user'}),()=>assert.fail('original content loaded for new account'))({method:'GET'},r);assert.equal(r.code,200);assert.equal(r.data.content,null);assert.equal(r.data.user.id,'new-user');});
