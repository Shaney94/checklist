const {test}=require('node:test'),assert=require('node:assert/strict');const {createApp}=require('../api/app');
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},end(data){this.data=data;return this}};}
test('logged-out app request redirects without loading private data',async()=>{const r=res();await createApp(async()=>null,()=>assert.fail('private data accessed'))({method:'GET'},r);assert.equal(r.code,303);assert(r.headers.Location.startsWith('/?next='));assert(!r.data);assert(r.headers['Cache-Control'].includes('no-store'));});
test('authenticated private HTML is served with no-store',async()=>{const r=res();await createApp(async()=>({}),()=>'<h1>Test private content</h1>')({method:'GET'},r);assert.equal(r.code,200);assert(r.data.includes('Test private content'));assert.equal(r.headers.Vary,'Cookie');});
test('authentication outage never exposes dashboard',async()=>{const r=res();await createApp(async()=>{throw Error('offline')},()=>assert.fail('private data accessed'))({method:'GET'},r);assert.equal(r.code,503);});
test('encrypted dashboard rejects an incorrect key or modified content',()=>{
 const crypto=require('node:crypto'),zlib=require('node:zlib'),{decryptDashboard}=require('../lib/private-content.cjs');
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const content=Buffer.concat([cipher.update(zlib.gzipSync('synthetic private content')),cipher.final()]);
 const data={iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),content:content.toString('base64')};
 assert.equal(decryptDashboard(data,key.toString('base64')),'synthetic private content');
 assert.throws(()=>decryptDashboard(data,crypto.randomBytes(32).toString('base64')));
 content[0]^=1;assert.throws(()=>decryptDashboard({...data,content:content.toString('base64')},key.toString('base64')));
});
