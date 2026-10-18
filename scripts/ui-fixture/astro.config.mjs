import {defineConfig} from 'astro/config';
import {resolve, dirname} from 'node:path';
import tailwindcss from '@tailwindcss/vite';

// Real portal components, synthetic data only; never import the Neon client or real secrets.
export default defineConfig({publicDir:resolve('public'),vite:{plugins:[{
  name:'fixture-voting-data', enforce:'pre',
  resolveId(source, importer) {
    const target=(source.startsWith('.') && importer ? resolve(dirname(importer),source) : source).replaceAll('\\','/');
    if(/(?:^|\/)lib\/prisma(?:\.ts)?$/.test(target))return '\0fixture-db';
    if(/(?:^|\/)lib\/env(?:\.ts)?$/.test(target))return '\0fixture-env';
    if(/(?:^|\/)lib\/voting\/participation(?:\.ts)?$/.test(target))return '\0fixture-participation';
  },
  transform(code,id) {
    // Public components live outside the fixture root, so Tailwind must scan the app sources.
    if(id.replaceAll('\\','/').endsWith('/src/styles/global.css'))return code+'\n@source "'+resolve('src').replaceAll('\\','/')+'";';
  },
  load(id) {
    if(id==='\0fixture-participation')return `
      const organizations=['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPNU','IPPNU'];
      const contests=organizations.map((organization,i)=>({organization,name:organization.replaceAll('_',' '),logoUrl:null,candidateMode:'SINGLE',chairLabel:'Ketua',viceChairLabel:null,sortOrder:i+1}));
      export const getParticipation=async(id)=>id.endsWith('9')?null:({period:{name:'Partisipasi sintetis',academicYear:'2026/2027',state:'SCHEDULED'},contests,eligible:3,complete:1,partial:1,notStarted:1,byOrganization:organizations.map(organization=>({organization,eligible:3,voted:organization==='OSIS'?2:1,pending:organization==='OSIS'?1:2}))});
      export const getParticipationVoters=async()=>({data:[0,1,2].map((index)=>({nisn:'990000000'+index,name:'Pemilih QA '+index,className:'X DKV',participation:Object.fromEntries(organizations.map((organization)=>[organization,index===0||index===1&&organization==='OSIS']))})),nextCursor:'qa-next'});
    `;
    if(id==='\0fixture-env')return "export const requireEnv = () => 'synthetic-fixture-secret-'.repeat(3); export const env = () => undefined;";
    if(id==='\0fixture-db')return `
      import assert from 'node:assert/strict';
      import {resultPeriod} from '${resolve('scripts/ui-fixture/src/results.ts').replaceAll('\\','/')}';
      let homeNewsStarted=false,homeAchievementsStarted=false;
      const project=(row,select)=>select?Object.fromEntries(Object.keys(select).filter(key=>select[key]).map(key=>[key,row[key]])):row;
      const articles=Array.from({length:3},(_,i)=>({slug:'synthetic-news-'+i,title:'Berita sintetis '+i,excerpt:'Ringkasan kartu tanpa konten artikel.',category:'Akademik',createdAt:new Date('2026-10-01'),imageUrl:i===1?'/api/image/qa/photo.jpg?w=960':'/api/image/qa/photo.jpg?version=2',content:'This must not be selected for cards'}));
      const achievements=Array.from({length:3},(_,i)=>({id:'qa-ach-'+i,title:'Prestasi sintetis '+i,description:'Deskripsi sintetis.',student:'Siswa QA',year:2026,level:'Kabupaten',imageUrl:'/api/image/qa/photo.jpg',featured:i===0}));
      const contests=['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPNU','IPPNU'].map((organization,i)=>({organization,nameSnapshot:organization.replaceAll('_',' '),logoUrlSnapshot:null,candidateModeSnapshot:i===0?'OPTIONAL_VICE':'SINGLE',chairLabelSnapshot:i===0?'Ketua OSIS snapshot':'Pradana snapshot',viceChairLabelSnapshot:i===0?'Wakil OSIS snapshot':null,sortOrder:i+1,_count:{candidates:1},candidates:[{members:[{position:'CHAIR',studentId:'qa-student'}]}]}));
      const period={contests,id:'10000000-0000-4000-8000-000000000001',slug:'mixed',name:'Synthetic Mixed Election',academicYear:'2026/2027',isTest:false,publishedAt:null,state:'SCHEDULED',opensAt:new Date(Date.now()-60000),closesAt:new Date(Date.now()+3600000)};
      const resultRows=[10,11,12,13,14,15].map(n=>({...period,id:'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),name:'Periode QA '+n,slug:n===10?'qa-results-5':n===11?'qa-results-archived':'unpublished-'+n,state:n===15?'SCHEDULED':[11,14].includes(n)?'ARCHIVED':'CLOSED',closedAt:n===15?null:new Date('2026-10-17T05:00:00Z'),publishedAt:[10,11,15].includes(n)?new Date('2026-10-17T05:15:00Z'):null}));
      const students=Array.from({length:31},(_,i)=>({id:'20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),nisn:String(9900000000+i).padStart(10,'0'),name:'Siswa Pilihan '+String(i+1).padStart(2,'0'),className:i%2?'X LPS':'X DKV'}));
      export const db={
        announcement:{findMany:async()=>{await new Promise(resolve=>setTimeout(resolve,20));assert.ok(homeNewsStarted&&homeAchievementsStarted,'homepage reads must start together');return [
          {id:'qa-ann-1',title:'Informasi sekolah',body:'Pengumuman sintetis untuk pemeriksaan tampilan.',imageUrl:null,linkUrl:'/ppdb',linkLabel:'Lihat pendaftaran',expiresAt:null,active:true},
          {id:'qa-ann-2',title:'Informasi kedua',body:'Pengumuman kedua yang lebih panjang untuk memeriksa rotasi dan pembungkusan teks pada layar mobile.',imageUrl:null,linkUrl:null,linkLabel:null,expiresAt:null,active:true},
        ]}},article:{findMany:async({select,take})=>{assert.ok(select&&!select.content,'article cards must not read full content');if(take===3)homeNewsStarted=true;return articles.map(row=>project(row,select))}},
        achievement:{findMany:async({where,select,take})=>{if(where?.featured)homeAchievementsStarted=true;return achievements.filter(row=>where?.featured?row.featured:!where?.id?.notIn?.includes(row.id)).slice(0,take??3).map(row=>project(row,select))}},
        galleryImage:{findMany:async()=>[{id:'qa-photo',title:'Foto sintetis',imageUrl:'/api/image/qa/photo.jpg?version=2',album:'Sekolah'}]},
        department:{findMany:async()=>[{name:'Jurusan QA',slug:'qa',icon:'school',description:'Deskripsi',kompetensi:'[]',karir:'[]',imageUrl:'/api/image/qa/photo.jpg'}]},
        extracurricular:{findMany:async()=>[{name:'Ekskul QA',description:'Deskripsi',imageUrl:'/api/image/qa/photo.jpg'}]},
        partner:{findMany:async()=>[{name:'Mitra QA',type:'Industri',logoUrl:'/api/image/qa/photo.jpg'}]},
        alumni:{findMany:async({select})=>select?[]:[{nama:'Alumni QA',photoUrl:'/api/image/qa/photo.jpg',angkatan:2026,jurusan:'DKV',status:'Bekerja'}]},
        facility:{findMany:async()=>[{id:'qa-custom-icon',name:'Fasilitas sintetis',description:'Ikon di luar subset',icon:'vacuum',imageUrl:null},{name:'Fasilitas foto QA',description:'Deskripsi',icon:'apartment',imageUrl:'/api/image/qa/photo.jpg'}]},
        $queryRaw:async()=>[{now:new Date()}],$transaction:async callback=>callback(db),
        electionPeriod:{findMany:async({where,select})=>(where?[period]:[period,...resultRows]).map(row=>project(row,select)),findFirst:async({where,select})=>{assert.deepEqual(where.state,{in:['CLOSED','ARCHIVED']});assert.deepEqual(where.publishedAt,{not:null});const record=resultPeriod(where.slug);return where.state.in.includes(record.state)&&record.publishedAt?project(record,select):null;},findUnique:async({where})=>({...period,id:where.id,closedAt:null,extensionUsedAt:null,contestsRevision:3,voters:[{credentialEnabled:true,pinHash:'synthetic',pinFingerprint:'synthetic',participation:contests.map(c=>({organization:c.organization}))}],state:[2,5,6,7,8,9].some(n=>where.id.endsWith(String(n)))?'SCHEDULED':'DRAFT',opensAt:new Date(Date.now()+(where.id.endsWith('6')?3600000:-3600000)),closesAt:new Date(Date.now()+([5,6,8,9].some(n=>where.id.endsWith(String(n)))?7200000:-1800000)),...resultRows.find(row=>row.id===where.id)})},
        student:{findMany:async()=>students},teacher:{findMany:async()=>[{id:'qa-master-teacher',name:'Guru QA',position:'Guru',level:'Guru',title:null,subject:'Matematika',photoUrl:'/api/image/qa/photo.jpg'}]},
        candidatePair:{findMany:async()=>[0,1].map(i=>({id:'40000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),organization:contests[i].organization,ballotNumber:1,vision:'Visi sintetis',mission:'Misi sintetis',members:(i===0?[0,1]:[2]).map((index,j)=>({position:j===0?'CHAIR':'VICE_CHAIR',studentId:students[index].id,nameSnapshot:'Nama snapshot '+index,classSnapshot:'Kelas snapshot',photoUrl:index===0?'/api/image/qa/portrait.png':null,student:students[index]}))}))},
        electionVoter:{findMany:async()=>[],findFirst:async()=>({voterType:'TEACHER',period,participation:contests.map(c=>({organization:c.organization,hasVoted:false}))})},
      };
    `;
  },
},tailwindcss()]}});
