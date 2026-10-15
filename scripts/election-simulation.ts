import {readFile,readdir,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {Client} from 'pg';
import bcrypt from 'bcryptjs';
import {assertSimulationTarget,assertSimulationOwnership,SIMULATION_DATABASE,SIMULATION_OWNER} from '../src/lib/simulation-guard';
import {generatePin,pinHashMaterial,pinFingerprint} from '../src/lib/voting/pin-input';
const action=process.argv[2]??'seed';
const scenario=process.argv.find(arg=>arg.startsWith('--scenario='))?.split('=')[1]??'ready';
const confirmation=process.argv.find(arg=>arg.startsWith('--confirm='))?.split('=')[1]??'';
if(!['seed','reset'].includes(action)||!['empty','ready','partial','completed','expired'].includes(scenario))throw new Error('INVALID_SIMULATION_COMMAND');
const env={...process.env,SMKDH_SIMULATION:process.env.SMKDH_SIMULATION??'1'};
const connectionString=process.env.SIMULATION_DATABASE_URL??'postgresql://smkdh_qa:smkdh_local_qa_only@127.0.0.1:54329/'+SIMULATION_DATABASE;
assertSimulationTarget(connectionString,env);
const client=new Client({connectionString});
const adminPassword=randomBytes(18).toString('base64url');
const secrets=Object.fromEntries(['JWT_SECRET','VOTING_CSRF_SECRET','VOTING_PIN_SECRET','VOTING_RATE_SECRET'].map(key=>[key,randomBytes(32).toString('hex')]));
const slips:Array<{nisn:string;pin:string;name:string}>=[];
try{
 await client.connect();await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(74190239)');
 const {rows:[{database}]}=await client.query('SELECT current_database() AS database');
 const {rows:[{marker}]}=await client.query(`SELECT to_regclass('public."_SMKDHSimulation"') AS marker`);
 if(action==='reset'){
   const owner=marker?(await client.query('SELECT owner FROM "_SMKDHSimulation"')).rows[0]?.owner:undefined;
   assertSimulationOwnership(database,owner,confirmation);
   await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
 }else{
   const {rows:[{count}]}=await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
   if(database!==SIMULATION_DATABASE||marker||count>0)throw new Error('SIMULATION_SEED_REQUIRES_EMPTY_DATABASE');
 }
 const migrations=(await readdir(new URL('../prisma/migrations/',import.meta.url),{withFileTypes:true})).filter(entry=>entry.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name));
 for(const migration of migrations)await client.query(await readFile(new URL('../prisma/migrations/'+migration.name+'/migration.sql',import.meta.url),'utf8'));
 await client.query('CREATE TABLE "_SMKDHSimulation" (owner TEXT NOT NULL)');
 await client.query('INSERT INTO "_SMKDHSimulation" VALUES ($1)',[SIMULATION_OWNER]);
 await client.query('INSERT INTO "Account" ("id","email","username","passwordHash") VALUES ($1,$2,$3,$4)',['qa-admin','qa@smkdh.test','qa-admin',await bcrypt.hash(adminPassword,12)]);
 await client.query('INSERT INTO "AccountRole" ("id","accountId","role") VALUES ($1,$2,$3)',['qa-admin-role','qa-admin','superadmin']);
 await client.query('INSERT INTO "Department" ("id","slug","name","description","kompetensi","karir") VALUES ($1,$2,$3,$4,$5,$6)',['qa-department','qa-dkv','DKV Simulasi','Data sintetis','[]','[]']);
 await client.query('INSERT INTO "SchoolClass" ("id","academicYear","name","departmentId") VALUES ($1,$2,$3,$4)',['qa-class','2026/2027','X DKV SIMULASI','qa-department']);
 const periodId=randomUUID(),orgs=['OSIS','DEWAN_AMBALAN','IPNU','IPPNU'];
 await client.query('INSERT INTO "ElectionPeriod" ("id","slug","name","academicYear","isTest","opensAt","closesAt") VALUES ($1,$2,$3,$4,true,clock_timestamp()+interval \'2 days\',clock_timestamp()+interval \'3 days\')',[periodId,'simulasi-qa','SIMULASI — '+scenario,'2026/2027']);
 for(const org of orgs)await client.query('INSERT INTO "ElectionContest" ("periodId","organization") VALUES ($1,$2)',[periodId,org]);
 const studentIds:string[]=[],voterIds:string[]=[];
 for(let i=1;i<=8;i++){
   const id=randomUUID(),nisn=String(9900000000+i),name='Siswa Simulasi '+String(i).padStart(2,'0');studentIds.push(id);
   await client.query('INSERT INTO "Student" ("id","nisn","name","className","schoolClassId") VALUES ($1,$2,$3,$4,$5)',[id,nisn,name,'X DKV SIMULASI','qa-class']);
   if(scenario==='empty')continue;
   const voterId=randomUUID(),pin=generatePin();voterIds.push(voterId);slips.push({nisn,name,pin});
   await client.query('INSERT INTO "ElectionVoter" ("id","studentId","periodId","nisn","name","className","pinHash","pinFingerprint","pinVersion") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)',[voterId,id,periodId,nisn,name,'X DKV SIMULASI',await bcrypt.hash(pinHashMaterial(secrets.VOTING_PIN_SECRET,periodId,nisn,pin),12),pinFingerprint(secrets.VOTING_PIN_SECRET,periodId,pin)]);
   for(const org of orgs)await client.query('INSERT INTO "VoterParticipation" ("voterId","periodId","organization") VALUES ($1,$2,$3)',[voterId,periodId,org]);
 }
 const pairs=new Map<string,string>();
 if(scenario!=='empty'){
  for(const org of orgs)for(let n=1;n<=2;n++){
   const pairId=randomUUID();if(n===1)pairs.set(org,pairId);
   await client.query('INSERT INTO "CandidatePair" ("id","periodId","organization","ballotNumber","vision","mission") VALUES ($1,$2,$3,$4,$5,$6)',[pairId,periodId,org,n,'Sekolah yang inklusif dan kreatif.','1. Mendengar aspirasi siswa.\n2. Menjalankan kegiatan bersama.']);
   for(const [index,position]of [[(n-1)*2,'CHAIR'],[(n-1)*2+1,'VICE_CHAIR']] as const)
    await client.query('INSERT INTO "CandidateMember" ("candidatePairId","periodId","organization","studentId","position","nameSnapshot","classSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7)',[pairId,periodId,org,studentIds[index],position,'Siswa Simulasi '+String(index+1).padStart(2,'0'),'X DKV SIMULASI']);
  }
  await client.query('UPDATE "ElectionPeriod" SET "state"=\'SCHEDULED\',"opensAt"=clock_timestamp()-interval \'1 minute\',"closesAt"=clock_timestamp()+interval \'2 hours\' WHERE "id"=$1',[periodId]);
  const votedOrgs=scenario==='completed'?orgs:scenario==='partial'?orgs.slice(0,2):[];
  for(const org of votedOrgs){
   await client.query('UPDATE "VoterParticipation" SET "hasVoted"=true WHERE "voterId"=$1 AND "organization"=$2',[voterIds[0],org]);
   await client.query('INSERT INTO "Ballot" ("id","periodId","organization","candidateId") VALUES ($1,$2,$3,$4)',[randomUUID(),periodId,org,pairs.get(org)]);
  }
  if(scenario==='expired')await client.query('UPDATE "ElectionPeriod" SET "opensAt"=clock_timestamp()-interval \'2 hours\',"closesAt"=clock_timestamp()-interval \'1 minute\' WHERE "id"=$1',[periodId]);
 }
 await client.query('COMMIT');
 await writeFile(new URL('../.env.simulation',import.meta.url),Object.entries({SMKDH_SIMULATION:'1',SIMULATION_DATABASE_URL:connectionString,DATABASE_URL:connectionString,...secrets}).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});
 console.log('Database SIMULASI lokal siap. Scenario: '+scenario+'\nAdmin: qa@smkdh.test\nPassword sintetis: '+adminPassword+'\nLogin siswa: http://localhost:4322/siswa/masuk?periode=simulasi-qa');
 console.table(slips);
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('Simulasi gagal:',error instanceof Error?error.message:'unknown error');process.exitCode=1}
finally{await client.end()}
