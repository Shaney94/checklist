const {test}=require('node:test'),assert=require('node:assert/strict');
const {testEnvironment}=require('./fixtures/test-environment.cjs');
const {config,schemaName,adapter}=require('./fixtures/postgres.cjs');
test('canonical verification removes app credentials and integration opt-ins without modifying the caller',()=>{
 const source={DATABASE_URL:'production',TURNLI_CONTENT_KEY:'secret',DESCOPE_MANAGEMENT_KEY:'secret',TURNLI_TEST_DATABASE:'1',NODE_OPTIONS:'--env-file=.env.local',PGHOST:'remote',TURNLI_TEST_PG_PORT:'55433',PATH:'/bin'};
 const env=testEnvironment(source);
 assert.equal(source.DATABASE_URL,'production');assert.equal(env.DATABASE_URL,'');assert.equal(env.TURNLI_CONTENT_KEY,'');assert.equal(env.DESCOPE_MANAGEMENT_KEY,'');assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.PGHOST,undefined);assert.equal(env.TURNLI_TEST_DATABASE,'0');assert.equal(env.PATH,'/bin');assert.equal(env.TURNLI_TEST_PG_PORT,'55433');
});
test('test database configuration cannot target caller-supplied hosts, users or production URLs',()=>{
 const c=config({DATABASE_URL:'postgresql://secret@production/production',PGHOST:'production',PGUSER:'production'});
 assert.equal(c.host,'127.0.0.1');assert.equal(c.database,'turnli_test');assert.equal(c.user,'turnli_test');assert.equal(c.port,55432);assert.equal(c.ssl,false);
 for(const port of ['0','5432?host=remote','NaN','65536'])assert.throws(()=>config({TURNLI_TEST_PG_PORT:port}));
 for(const name of [undefined,'public','turnli_test_foo','turnli_test_'+ 'a'.repeat(32)+';DROP SCHEMA public'])assert.throws(()=>schemaName(name));
 assert.equal(schemaName('turnli_test_'+'a'.repeat(32)),'turnli_test_'+'a'.repeat(32));
});
test('PostgreSQL test adapter preserves parameterization and lazy same-client transaction execution',async()=>{
 const calls=[];const client={query:async(text,values)=>{calls.push({text,values});return {rows:[{ok:true}]}},release:()=>calls.push('release')};
 const sql=adapter({connect:async()=>client,query:()=>assert.fail('transaction escaped its client')});
 const q=sql`SELECT ${"'private'"}::text`;assert.equal(calls.length,0);
 assert.deepEqual(await sql.transaction([q,sql`SELECT ${2}::int`]),[[{ok:true}],[{ok:true}]]);
 assert.deepEqual(calls.map(c=>typeof c==='string'?c:c.text),['BEGIN','SELECT $1::text','SELECT $1::int','COMMIT','release']);assert.deepEqual(calls[1].values,["'private'"]);
});
test('PostgreSQL test adapter rolls back failures and releases its client',async()=>{
 const calls=[];const sql=adapter({connect:async()=>({query:async text=>{calls.push(text);if(text==='bad')throw Error('synthetic');return {rows:[]}},release:()=>calls.push('release')})});
 await assert.rejects(sql.transaction([sql.query('bad')]),/synthetic/);assert.deepEqual(calls,['BEGIN','bad','ROLLBACK','release']);
});
