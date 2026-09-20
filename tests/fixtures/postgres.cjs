// Test-only transport for the existing store SQL. Never imported by the app.
const {Pool}=require('pg');
function config(env=process.env){
 const port=Number(env.TURNLI_TEST_PG_PORT||55432);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local test PostgreSQL port.');
 return {host:'127.0.0.1',port,user:'turnli_test',password:'turnli_test',database:'turnli_test',ssl:false,connectionTimeoutMillis:5000,allowExitOnIdle:true};
}
function schemaName(value){
 if(!/^turnli_test_[a-f0-9]{32}$/.test(value||''))throw Error('Use npm run test:integration; an isolated test schema is required.');
 return value;
}
function adapter(pool){
 // Neon query objects are lazy; transaction([...]) must execute all statements
 // on the same client, rather than dispatching them via separate pool clients.
 const query=(text,values=[])=>({text,values,then(resolve,reject){return pool.query(text,values).then(r=>r.rows).then(resolve,reject);}});
 const sql=(strings,...values)=>query(strings.reduce((text,part,i)=>text+(i?'$'+i:'')+part,''),values);
 sql.query=query;
 sql.transaction=async queries=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=[];for(const q of queries)result.push((await client.query(q.text,q.values)).rows);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 };
 return sql;
}
function install(){
 const schema=schemaName(process.env.TURNLI_INTEGRATION_SCHEMA);
 const db=adapter(new Pool({...config(),options:`-c search_path=${schema},pg_catalog`}));
 const modulePath=require.resolve('@neondatabase/serverless');
 const original=require(modulePath);
 require.cache[modulePath].exports={...original,neon:()=>db};
 // This sentinel satisfies the application's configuration check; it is never
 // used as a network destination. Only the fixed local config above is used.
 process.env.DATABASE_URL='postgresql://turnli_test@127.0.0.1/turnli_test';
}
module.exports={config,schemaName,adapter,install};
