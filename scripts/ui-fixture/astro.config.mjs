import {defineConfig} from 'astro/config';
import {resolve, dirname} from 'node:path';

// Real portal components, synthetic data only; never import the Neon client or real secrets.
export default defineConfig({vite:{plugins:[{
  name:'fixture-voting-data', enforce:'pre',
  resolveId(source, importer) {
    const target=(source.startsWith('.') && importer ? resolve(dirname(importer),source) : source).replaceAll('\\','/');
    if(/(?:^|\/)lib\/prisma(?:\.ts)?$/.test(target))return '\0fixture-db';
    if(/(?:^|\/)lib\/env(?:\.ts)?$/.test(target))return '\0fixture-env';
  },
  load(id) {
    if(id==='\0fixture-env')return "export const requireEnv = () => 'synthetic-fixture-secret-'.repeat(3); export const env = () => undefined;";
    if(id==='\0fixture-db')return `
      const period={id:'10000000-0000-4000-8000-000000000001',slug:'mixed',name:'Synthetic Mixed Election',state:'SCHEDULED',opensAt:new Date(Date.now()-60000),closesAt:new Date(Date.now()+3600000)};
      const students=Array.from({length:31},(_,i)=>({id:'20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),nisn:String(9900000000+i).padStart(10,'0'),name:'Siswa Pilihan '+String(i+1).padStart(2,'0'),className:i%2?'X LPS':'X DKV'}));
      export const db={
        $queryRaw:async()=>[{now:new Date()}],
        electionPeriod:{findMany:async()=>[period],findUnique:async({where})=>({...period,id:where.id,academicYear:'2026/2027',state:where.id.endsWith('2')?'SCHEDULED':'DRAFT',opensAt:new Date(Date.now()-3600000),closesAt:new Date(Date.now()-1800000)})},
        student:{findMany:async()=>students},teacher:{findMany:async()=>[{id:'qa-master-teacher',name:'Guru QA',position:'Guru',level:'Guru'}]},
        electionVoter:{findMany:async()=>[],findFirst:async()=>({voterType:'TEACHER',period,participation:['OSIS','DEWAN_AMBALAN','IPNU','IPPNU'].map(organization=>({organization,hasVoted:false}))})},
      };
    `;
  },
}]}});
