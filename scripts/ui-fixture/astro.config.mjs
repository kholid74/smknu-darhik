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
  },
  transform(code,id) {
    // Public components live outside the fixture root, so Tailwind must scan the app sources.
    if(id.replaceAll('\\','/').endsWith('/src/styles/global.css'))return code+'\n@source "'+resolve('src').replaceAll('\\','/')+'";';
  },
  load(id) {
    if(id==='\0fixture-env')return "export const requireEnv = () => 'synthetic-fixture-secret-'.repeat(3); export const env = () => undefined;";
    if(id==='\0fixture-db')return `
      import assert from 'node:assert/strict';
      let homeNewsStarted=false,homeAchievementsStarted=false;
      const project=(row,select)=>select?Object.fromEntries(Object.keys(select).filter(key=>select[key]).map(key=>[key,row[key]])):row;
      const articles=Array.from({length:3},(_,i)=>({slug:'synthetic-news-'+i,title:'Berita sintetis '+i,excerpt:'Ringkasan kartu tanpa konten artikel.',category:'Akademik',createdAt:new Date('2026-10-01'),imageUrl:i===1?'/api/image/qa/photo.jpg?w=960':'/api/image/qa/photo.jpg?version=2',content:'This must not be selected for cards'}));
      const achievements=Array.from({length:3},(_,i)=>({id:'qa-ach-'+i,title:'Prestasi sintetis '+i,description:'Deskripsi sintetis.',student:'Siswa QA',year:2026,level:'Kabupaten',imageUrl:'/api/image/qa/photo.jpg',featured:i===0}));
      const period={id:'10000000-0000-4000-8000-000000000001',slug:'mixed',name:'Synthetic Mixed Election',state:'SCHEDULED',opensAt:new Date(Date.now()-60000),closesAt:new Date(Date.now()+3600000)};
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
        $queryRaw:async()=>[{now:new Date()}],
        electionPeriod:{findMany:async()=>[period],findUnique:async({where})=>({...period,id:where.id,academicYear:'2026/2027',state:where.id.endsWith('2')?'SCHEDULED':'DRAFT',opensAt:new Date(Date.now()-3600000),closesAt:new Date(Date.now()-1800000)})},
        student:{findMany:async()=>students},teacher:{findMany:async()=>[{id:'qa-master-teacher',name:'Guru QA',position:'Guru',level:'Guru',title:null,subject:'Matematika',photoUrl:'/api/image/qa/photo.jpg'}]},
        electionVoter:{findMany:async()=>[],findFirst:async()=>({voterType:'TEACHER',period,participation:['OSIS','DEWAN_AMBALAN','IPNU','IPPNU'].map(organization=>({organization,hasVoted:false}))})},
      };
    `;
  },
},tailwindcss()]}});
