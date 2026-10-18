// Isolated local PostgreSQL only. No .env, Neon, or production data.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
const run=promisify(execFile),bin=resolve(process.env.PG_TEST_BIN??'artifacts/ui-qa/postgres/pgsql/bin');
const exe=name=>resolve(bin,name+(process.platform==='win32'?'.exe':''));
await access(exe('initdb'));
await mkdir('artifacts/ui-qa',{recursive:true});const root=await mkdtemp(resolve('artifacts/ui-qa/pg-t11-'));
const password=randomBytes(24).toString('hex');await writeFile(resolve(root,'password'),password,{mode:0o600});
const listener=createServer();await new Promise(done=>listener.listen(0,'127.0.0.1',done));const port=listener.address().port;await new Promise(done=>listener.close(done));
const data=resolve(root,'data'),log=resolve(root,'postgres.log');
const env={...process.env,PGPASSWORD:password,PGSSLMODE:'disable'};delete env.DATABASE_URL;delete env.SIMULATION_DATABASE_URL;
const options={env,windowsHide:true,timeout:45000,maxBuffer:4*1024*1024};let started=false;
try{
 await run(exe('initdb'),['-D',data,'-U','qa_voting','--pwfile='+resolve(root,'password'),'--auth=scram-sha-256','--encoding=UTF8','--locale=C'],options);
 started=true;await run(exe('pg_ctl'),['start','-w','-D',data,'-l',log,'-o','-h 127.0.0.1 -p '+port],options);
 await run(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','qa_voting','smkdh_voting_t11_only'],options);
 const result=await run(process.execPath,['node_modules/tsx/dist/cli.mjs','--test','--test-concurrency=1','src/lib/voting/postgres-concurrency.test.ts'],{...options,timeout:180000,env:{...env,SMKDH_TEST_DATABASE_URL:'postgresql://qa_voting:'+password+'@127.0.0.1:'+port+'/smkdh_voting_t11_only?sslmode=disable'}});
 await writeFile('artifacts/ui-qa/t11-postgres-tests.log',result.stdout+result.stderr);console.log(result.stdout);
 await writeFile('artifacts/ui-qa/t11-postgres-run.json',JSON.stringify({at:new Date().toISOString(),passed:true,isolatedDatabase:'smkdh_voting_t11_only',logDirectory:root,scope:'Real local PostgreSQL with multiple connections; not Neon/Vercel/physical Chromebooks.'},null,2));
}catch(error){
 const output=String(error.stdout??'')+String(error.stderr??error.message??'');
 await writeFile('artifacts/ui-qa/t11-postgres-tests.log',output.replaceAll(password,'[redacted]'));
 console.error('Isolated PostgreSQL verification failed; see artifacts/ui-qa/t11-postgres-tests.log');process.exitCode=1;
}finally{
 if(started){
  try{await run(exe('pg_ctl'),['stop','-w','-m','fast','-D',data],options);console.log('Local PostgreSQL stopped.');}
  catch{console.error('Could not confirm PostgreSQL shutdown; inspect the isolated cluster log.');process.exitCode=1;}
 }else console.log('Local PostgreSQL was not started.');
}
