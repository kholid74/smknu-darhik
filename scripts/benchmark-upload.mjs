// Local public/synthetic inputs only; no .env, database or R2 access.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {tsImport} from 'tsx/esm/api';
import assert from 'node:assert/strict';
const started=performance.now();
const {prepareUpload}=await tsImport('../src/lib/upload-file.ts',import.meta.url);
const root='artifacts/ui-qa/upload';await mkdir(root,{recursive:true});
const portrait=await readFile('public/assets/kepala-sekolah.png');
if(process.argv.includes('--cold')){
 const result=await prepareUpload(new File([portrait],'portrait.png'));
 console.log(JSON.stringify({moduleAndFirstEncodeMs:performance.now()-started,outputBytes:result.size,maxRssKiB:process.resourceUsage().maxRSS,scope:'fresh local Node process; not Vercel cold start'}));
 process.exit(0);
}
const inputs=[['portrait',await sharp(portrait).jpeg({quality:95}).toBuffer(),'jpg','photo'],['hero',await sharp(await readFile('public/assets/hero-siswa.png')).jpeg({quality:95}).toBuffer(),'jpg','photo'],['logo',await readFile('public/assets/logo.png'),'png','logo'],['near-5MiB',await sharp(randomBytes(1600*1000*3),{raw:{width:1600,height:1000,channels:3}}).png().toBuffer(),'png','photo']];
const rows=[];
for(const [name,input,extension,kind]of inputs){
 assert.ok(input.length<=5*1024*1024);
 const times=[],cpu=[];let stored;
 for(let i=0;i<4;i++){
  const begin=performance.now(),usage=process.cpuUsage();
  stored=await prepareUpload(new File([input],name+'.'+extension),kind);
  if(i){times.push(performance.now()-begin);const elapsed=process.cpuUsage(usage);cpu.push((elapsed.user+elapsed.system)/1000);}
 }
 const old=await sharp(input).resize(1800,1800,{fit:'inside',withoutEnlargement:true}).jpeg({quality:85,progressive:true}).toBuffer();
 const q80=await sharp(input).autoOrient().resize(1800,1800,{fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
 await writeFile(root+'/'+name+'-new.webp',stored.buffer);
 if(name==='portrait'){await writeFile(root+'/portrait-input.jpg',input);await writeFile(root+'/portrait-q80.webp',q80);}
 rows.push({name,purpose:kind,inputBytes:input.length,oldJpeg85Bytes:old.length,storedBytes:stored.size,q80Bytes:q80.length,medianEncodeMs:times.sort((a,b)=>a-b)[1],medianCpuMs:cpu.sort((a,b)=>a-b)[1],peakProcessRssKiB:process.resourceUsage().maxRSS});
}
const child=spawnSync(process.execPath,['scripts/benchmark-upload.mjs','--cold'],{encoding:'utf8',windowsHide:true});assert.equal(child.status,0,child.stderr);
const report={at:new Date().toISOString(),node:process.version,sharp:sharp.versions.sharp,rows,cold:JSON.parse(child.stdout),limits:'Local encoding/process metrics only. R2 request latency, full hosted upload, multipart limit and Vercel cold start remain unmeasured. Near-limit image is random synthetic noise; JPEG85 baseline is only applicable to opaque photos.'};
await writeFile(root+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
