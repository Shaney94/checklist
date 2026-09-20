const {test}=require('node:test'),assert=require('node:assert/strict');
const {validOrigin}=require('../lib/account.cjs');
function environment(values,run){const keys=['NODE_ENV','VERCEL','VERCEL_ENV','TURNLI_LOCAL_ORIGIN'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));try{for(const k of keys)delete process.env[k];Object.assign(process.env,values);run();}finally{for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
const allowed=origin=>validOrigin({headers:{origin,host:'localhost:3000','x-forwarded-host':'localhost:3000'}});
test('production origin policy remains exact and ignores request-derived hosts',()=>{
 environment({NODE_ENV:'production'},()=>{
  for(const origin of ['https://turnli.io','https://turnli.vercel.app'])assert.equal(allowed(origin),true);
  for(const origin of [undefined,'null','http://localhost:3000','http://127.0.0.1:3100','https://turnli-preview.vercel.app','https://turnli.io.evil.example'])assert.equal(allowed(origin),false);
 });
});
test('local development accepts only its exact default loopback origins',()=>{
 environment({NODE_ENV:'development'},()=>{
  for(const origin of ['http://localhost:3000','http://127.0.0.1:3000'])assert.equal(allowed(origin),true);
  for(const origin of ['http://localhost:3001','http://localhost.evil.example:3000','http://192.168.1.5:3000','https://evil.example'])assert.equal(allowed(origin),false);
 });
});
test('explicit local origin supports custom local servers but never Vercel deployments or arbitrary hosts',()=>{
 environment({NODE_ENV:'production',TURNLI_LOCAL_ORIGIN:'http://127.0.0.1:3100'},()=>{
  assert.equal(allowed('http://127.0.0.1:3100'),true);assert.equal(allowed('http://localhost:3100'),false);
  for(const variable of ['VERCEL','VERCEL_ENV']){process.env[variable]='1';assert.equal(allowed('http://127.0.0.1:3100'),false);delete process.env[variable];}
  for(const value of ['https://evil.example','http://localhost:3000/','http://localhost:65536','http://localhost:0','http://localhost.evil.example:3000','http://user@localhost:3000']){process.env.TURNLI_LOCAL_ORIGIN=value;assert.equal(allowed(value),false);}
 });
});
