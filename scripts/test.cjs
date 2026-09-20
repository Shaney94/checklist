const {readdirSync,readFileSync}=require('node:fs');
const {spawnSync}=require('node:child_process');
const {randomUUID,randomBytes}=require('node:crypto');
const {testEnvironment}=require('../tests/fixtures/test-environment.cjs');
const kind=process.argv[2];
if(!['unit','integration'].includes(kind))throw Error('Choose unit or integration.');
const files=readdirSync('tests').filter(f=>f.endsWith('.test.cjs')&&f.includes('.integration.')===(kind==='integration')).sort().map(f=>'tests/'+f);
const requested=process.argv.slice(3);
if(requested.some(f=>!files.includes(f)))throw Error('Choose existing test files from the requested suite.');
const selected=requested.length?requested:files;
const env=testEnvironment();
const run=()=>spawnSync(process.execPath,['--test','--test-concurrency=1',...selected],{env,stdio:'inherit'}).status??1;
if(kind==='unit')process.exitCode=run();
else (async()=>{
 const {Pool}=require('pg'),{config}=require('../tests/fixtures/postgres.cjs');
 const pool=new Pool(config(env)),schema='turnli_test_'+randomUUID().replaceAll('-','');
 let created=false;
 try{
  await pool.query(`CREATE SCHEMA "${schema}"`);created=true;
  const client=await pool.connect();
  try{
   await client.query(`SET search_path TO "${schema}", pg_catalog`);
   for(const file of readdirSync('migrations').filter(f=>/^\d+.*\.sql$/.test(f)).sort())await client.query(readFileSync('migrations/'+file,'utf8'));
  }finally{client.release();}
  env.TURNLI_INTEGRATION_SCHEMA=schema;env.TURNLI_TEST_DATABASE='1';env.TURNLI_CONTENT_KEY=randomBytes(32).toString('base64');
  process.exitCode=run();
 }catch(error){console.error('Isolated PostgreSQL verification failed:',error.code||error.name);console.error('Start the local test database described in docs/testing.md. Production DATABASE_URL is never used.');process.exitCode=1;}
 finally{
  try{if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await pool.end();}
 }
})().catch(()=>{console.error('Test database cleanup failed.');process.exitCode=1;});
