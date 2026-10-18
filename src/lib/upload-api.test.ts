import {test,beforeEach,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createContext} from 'astro/middleware';
import {S3Client} from '@aws-sdk/client-s3';
import sharp from 'sharp';
let indexed:any[]=[],objects:any[]=[],failStorage=false,failIndex=false,active=true,revoked=false;
const fixtureDb={account:{findUnique:async()=>active?{active:true,roles:[{role:'superadmin'}],overrides:revoked?[{capability:'media.kelola',effect:'revoke'}]:[]}:null},media:{create:async({data}:any)=>{if(failIndex)throw Error('Private DB details');indexed.push(data);return{id:'qa-media'};}}};
const globals=globalThis as typeof globalThis & {uploadTestDb?:typeof fixtureDb};globals.uploadTestDb=fixtureDb;
register('data:text/javascript,'+encodeURIComponent(`
 const mod=s=>({url:'data:text/javascript,'+encodeURIComponent(s),shortCircuit:true});
 export function resolve(specifier,context,next){
  if(specifier==='astro:middleware')return next('astro/middleware',context);
  if(specifier.startsWith('.')&&context.parentURL?.includes('/src/')){
   const p=new URL(specifier,context.parentURL).pathname;
   if(p.endsWith('/lib/prisma')||p.endsWith('/lib/prisma.ts'))return mod('export const db=globalThis.uploadTestDb');
   if(p.endsWith('/lib/env')||p.endsWith('/lib/env.ts'))return mod("const values={R2_ENDPOINT:'https://r2.example.test',R2_ACCESS_KEY:'synthetic',R2_SECRET_KEY:'synthetic',R2_BUCKET:'qa-media',R2_PUBLIC_URL:'/api/image'};export const env=k=>values[k];export const requireEnv=k=>values[k]??'synthetic-upload-secret-'.repeat(4)");
  }return next(specifier,context);
 }
`),import.meta.url);
mock.method(S3Client.prototype,'send',async(command:any)=>{if(failStorage)throw Error('Private storage credentials');objects.push(command.input);return{};});
const {onRequest}=await import('../middleware');
const {ALL:admin}=await import('../pages/api/upload');
const {ALL:alumni}=await import('../pages/api/alumni/upload');
const {signToken}=await import('./auth');const {signAlumniSession}=await import('./alumni-auth');
const {uploadToR2}=await import('./r2');
const token=await signToken('qa-admin',['superadmin']),alumniToken=await signAlumniSession('qa-alumni');
const bytes=await sharp({create:{width:32,height:48,channels:3,background:'#a27656'}}).jpeg({quality:98}).toBuffer();
beforeEach(()=>{indexed=[];objects=[];failStorage=false;failIndex=false;active=true;revoked=false;});
after(()=>{delete globals.uploadTestDb;mock.restoreAll();});
async function visit(realm='admin',options:{file?:File;fields?:Record<string,string>;cookie?:string;origin?:string;method?:string;duplicate?:boolean;headers?:Record<string,string>}={}){
 const path=realm==='alumni'?'/api/alumni/upload':'/api/upload',form=new FormData();
 form.append('file',options.file??new File([bytes],'portrait.jpg',{type:'image/jpeg'}));
 for(const [key,value]of Object.entries(options.fields??{}))form.append(key,value);
 if(options.duplicate)form.append('file',new File([bytes],'second.jpg'));
 const context=createContext({request:new Request('http://localhost:4321'+path,{method:options.method??'POST',headers:{Cookie:options.cookie??(realm==='alumni'?'smkdh_alumni='+alumniToken:'smkdh_token='+token),Origin:options.origin??'http://localhost:4321',...options.headers},...(options.method==='GET'?{}:{body:form})})});
 return onRequest(context,()=>realm==='alumni'?alumni!(context):admin!(context));
}
test('admin upload stores WebP bytes/Content-Type/UUID key and indexes output metadata while retaining original name',async()=>{
 const response=await visit('admin',{fields:{folder:'e-voting',assetKind:'photo'}});assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.id,'qa-media');assert.equal(body.mimeType,'image/webp');assert.equal(body.kind,'image');assert.equal(body.size,objects[0].Body.length);
 assert.equal(objects[0].ContentType,'image/webp');assert.match(objects[0].Key,/^e-voting\/\d{8}-[0-9a-f-]{36}\.webp$/);
 assert.equal(indexed[0].filename,'portrait.jpg');assert.equal(indexed[0].mimeType,body.mimeType);assert.equal(indexed[0].size,body.size);
 assert.equal((await sharp(objects[0].Body).metadata()).format,'webp');assert.match(response.headers.get('Cache-Control')!,/no-store/);
 await visit();assert.notEqual(objects[1].Key,objects[0].Key);
});
test('alumni accepts only its photo realm and forced folder; PIN/internal cookies are not alumni sessions',async()=>{
 const response=await visit('alumni');assert.equal(response.status,200);const body=await response.json();assert.equal(body.mimeType,'image/webp');assert.equal(indexed[0].folder,'alumni');assert.match(objects[0].Key,/^alumni\//);
 for(const fields of [{folder:'uploads'},{assetKind:'logo'},{assetKind:'document'}])assert.equal((await visit('alumni',{fields})).status,400);
 assert.equal((await visit('alumni',{cookie:'smkdh_token='+token})).status,401);
 assert.equal((await visit('alumni',{cookie:'smkdh_voting=synthetic-pin-session'})).status,401);
 assert.equal((await visit('alumni',{file:new File(['%PDF-1.7'],'file.pdf',{type:'image/png'})})).status,415);
 assert.equal(objects.length,1);
});
test('admin RBAC, current account status, origin and multipart bounds reject without storage writes',async()=>{
 for(const cookie of ['','smkdh_alumni='+alumniToken,'smkdh_voting=synthetic-pin-session'])assert.equal((await visit('admin',{cookie})).status,401);
 revoked=true;assert.equal((await visit()).status,403);revoked=false;active=false;assert.equal((await visit()).status,401);active=true;
 assert.equal((await visit('admin',{origin:'https://foreign.example'})).status,403);
 assert.equal((await visit('alumni',{origin:'https://foreign.example'})).status,403);
 assert.equal((await visit('admin',{fields:{folder:'../other'}})).status,400);
 assert.equal((await visit('admin',{fields:{assetKind:'unknown'}})).status,400);
 assert.equal((await visit('admin',{duplicate:true})).status,400);
 assert.equal((await visit('admin',{headers:{'Content-Length':String(6*1024*1024)}})).status,413);
 assert.equal((await visit('admin',{method:'GET'})).status,405);assert.equal(objects.length,0);assert.equal(indexed.length,0);
});
test('docs remain byte-identical and get attachment headers, while invalid images never fall back to raw storage',async()=>{
 const pdf=Buffer.from('%PDF-1.7\nfixture\n%%EOF');const response=await visit('admin',{file:new File([pdf],'test.pdf',{type:'image/png'}),fields:{folder:'downloads',assetKind:'document'}});
 assert.equal(response.status,200);assert.deepEqual(objects[0].Body,pdf);assert.equal(objects[0].ContentType,'application/pdf');assert.equal(objects[0].ContentDisposition,'attachment');assert.equal(indexed[0].size,pdf.length);
 assert.equal((await visit('admin',{file:new File([Buffer.from('ffd8ff','hex')],'bad.jpg')})).status,422);
 assert.equal((await visit('admin',{file:new File(['<script>bad</script>'],'fake.jpg',{type:'image/jpeg'})})).status,415);assert.equal(objects.length,1);
});
test('storage errors are generic and do not index; indexing errors keep a usable URL with an explicit warning',async()=>{
 failStorage=true;const failed=await visit();assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/credentials|Private/);assert.equal(indexed.length,0);
 failStorage=false;failIndex=true;const response=await visit();assert.equal(response.status,200);const body=await response.json();assert.equal(body.id,null);assert.match(body.warning,/belum tercatat/);assert.ok(body.url);assert.equal(objects.length,1);
});
test('upload helper rejects arbitrary prefixes before sending an object',async()=>{
 await assert.rejects(uploadToR2(new File([bytes],'photo.jpg'),'uploads/../../other'),{status:400});assert.equal(objects.length,0);
});
