const {test}=require('node:test');
const assert=require('node:assert/strict');
const {adapt}=require('../src/server/route-adapter.ts');

test('App Router adapter preserves separate secure cookies and refresh response headers',async()=>{
 const route=adapt((req,res)=>{
  assert.equal(req.headers.cookie,'session=existing');assert.equal(req.query.action,'policy');
  res.setHeader('Set-Cookie',['one=1; Secure; HttpOnly; Path=/','two=2; Secure; HttpOnly; Path=/']);
  res.setHeader('Set-Cookie',[...res.getHeader('set-cookie'),'three=3; Max-Age=0; Path=/']);
  res.setHeader('Vary','Cookie');return res.status(201).json({ok:true});
 });
 const response=await route(new Request('https://turnli.vercel.app/api/account?action=policy',{headers:{cookie:'session=existing'}}));
 assert.equal(response.status,201);assert.equal(response.headers.getSetCookie().length,3);
 assert.equal(response.headers.get('Vary'),'Cookie');assert.match(response.headers.get('Cache-Control'),/no-store/);assert.deepEqual(await response.json(),{ok:true});
});
test('adapter rejects oversized and malformed bodies before calling domain handlers',async()=>{
 const route=adapt(()=>assert.fail('handler called'),8);
 for(const [body,status] of [['{"long":true}',413],['{',400]]){
  const response=await route(new Request('https://turnli.vercel.app/api/account',{method:'POST',body}));
  assert.equal(response.status,status);assert.match(response.headers.get('Cache-Control'),/no-store/);
 }
});
test('adapter preserves real origin for existing CSRF checks',async()=>{
 const {createHandler}=require('../src/server/handlers/dashboard.js');
 const response=await adapt(createHandler(()=>assert.fail('authenticated cross-origin request')))(new Request('https://turnli.vercel.app/api/dashboard',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,403);
});
test('adapter preserves binary image/calendar responses and redirects',async()=>{
 const bytes=Uint8Array.from([0,255,23,190]);
 const image=await adapt((req,res)=>{res.setHeader('Content-Type','image/jpeg');res.end(bytes);})(new Request('https://turnli.vercel.app/api/calendar'));
 assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 const redirect=await adapt((req,res)=>{res.setHeader('Location','/?next=%2Fapp');res.status(303).end();})(new Request('https://turnli.vercel.app/app'));
 assert.equal(redirect.status,303);assert.equal(redirect.headers.get('Location'),'/?next=%2Fapp');
});
