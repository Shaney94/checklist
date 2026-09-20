// Canonical verification never reads credentials from the shell or Next env files.
const {readFileSync}=require('node:fs');
function testEnvironment(source=process.env){
 const env={...source};
 for(const key of Object.keys(env))if(/^(?:DESCOPE_|TURNLI_|NEXT_PUBLIC_DESCOPE_|POSTGRES_|PG)|^(?:DATABASE_URL|CRON_SECRET|NODE_OPTIONS)$/.test(key))delete env[key];
 for(const line of readFileSync('.env.example','utf8').split('\n')){
  const key=line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];if(key)env[key]='';
 }
 env.TURNLI_TEST_DATABASE='0';
 if(source.TURNLI_TEST_PG_PORT)env.TURNLI_TEST_PG_PORT=source.TURNLI_TEST_PG_PORT;
 env.NEXT_TELEMETRY_DISABLED='1';
 return env;
}
module.exports={testEnvironment};
