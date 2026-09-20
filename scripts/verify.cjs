const {spawnSync}=require('node:child_process');
const {testEnvironment}=require('../tests/fixtures/test-environment.cjs');
const full=process.argv[2]==='full';
if(process.argv[2]&&!full)throw Error('Use npm run verify or npm run verify:full.');
const env=testEnvironment();
for(const script of ['typecheck','lint','test:unit',...(full?['test:integration','build','test:e2e:critical']:[])]){
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',script],{env,stdio:'inherit'});
 if(result.status!==0){process.exitCode=result.status||1;break;}
}
