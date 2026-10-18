import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {imageResponse}=await tsImport('../src/lib/image-response.ts',import.meta.url);
const {prepareUpload}=await tsImport('../src/lib/upload-file.ts',import.meta.url);
const uploadRequests=[],uploadedFiles=new Map();let uploadMode='normal';
const fixtureRoot=resolve('scripts/ui-fixture/dist');
const imageRenders=[];
const periodRequests=[],typeRequests=[];
const typeMutations=[],contestMutations=[];
const candidateMutations=[];
const closeRequests=[];
const publishRequests=[];
let publishError='INVALID_REAUTH',periodCsrfReady=true;
let closeError='INVALID_REAUTH';
let candidateMutationCode='STALE_CANDIDATE';
let typeMutationMode='conflict',contestMutationMode='candidates';
let typeFixtureMode='normal';
const typeFixture=[...['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPNU','IPPNU'].map(code=>({code,name:code.replaceAll('_',' ')})),...Array.from({length:95},(_,i)=>({code:'EXTRA_'+i,name:'Extra '+i})),{code:'SIXTH_NEW',name:'<b>Jenis tambahan</b>'}];
const server=createServer(async(request,response)=>{try{
  const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(path==='/api/upload'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers['content-type']}}).formData();
    const file=form.get('file');uploadRequests.push({name:file.name,folder:form.get('folder'),assetKind:form.get('assetKind')});
    if(uploadMode==='error'){response.writeHead(503,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'Upload belum berhasil.'}));return;}
    const stored=await prepareUpload(file,form.get('assetKind')??undefined),url='/api/image/qa/upload-'+uploadRequests.length+'.'+stored.extension;
    uploadedFiles.set(url,stored);response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({url,id:uploadMode==='noindex'?null:'qa-upload',mimeType:stored.mimeType,size:stored.size,kind:stored.kind,...(uploadMode==='noindex'?{warning:'File tersimpan, tetapi belum tercatat di pustaka media.'}:{})}));return;
  }
  if(uploadedFiles.has(path)){const stored=uploadedFiles.get(path);response.writeHead(200,{'Content-Type':stored.mimeType});response.end(stored.buffer);return;}
  if (/^\/api\/admin\/e-voting\/[0-9a-f-]{36}$/.test(path)&&request.method==='GET') {
    if(!periodCsrfReady){response.writeHead(503).end();return;}
    response.writeHead(200,{'Content-Type':'application/json','X-CSRF-Token':'synthetic-period-csrf'});response.end(JSON.stringify({data:{}}));return;
  }
  if (/^\/api\/admin\/e-voting\/[^/]+\/publish$/.test(path)&&request.method==='POST') {
    let raw='';for await(const chunk of request)raw+=chunk;
    publishRequests.push({body:JSON.parse(raw),csrf:request.headers['x-csrf-token']});
    response.writeHead(publishError==='success'?200:publishError==='TEMPORARILY_UNAVAILABLE'?503:publishError==='INVALID_REAUTH'?401:publishError==='RATE_LIMITED'?429:publishError==='FORBIDDEN'||publishError==='CSRF_REJECTED'?403:409,{'Content-Type':'application/json'});
    response.end(JSON.stringify(publishError==='success'?{data:{publishedAt:new Date().toISOString()}}:{error:{code:publishError}}));return;
  }
  if (/^\/api\/admin\/e-voting\/[^/]+\/close$/.test(path)&&request.method==='POST') {
    let raw='';for await(const chunk of request)raw+=chunk;
    closeRequests.push({body:JSON.parse(raw),csrf:request.headers['x-csrf-token']});
    response.writeHead(closeError==='success'?200:closeError==='INVALID_REAUTH'?401:closeError==='RATE_LIMITED'?429:closeError==='TEMPORARILY_UNAVAILABLE'?503:409,{'Content-Type':'application/json'});
    response.end(JSON.stringify(closeError==='success'?{data:{state:'CLOSED',closedAt:new Date().toISOString()}}:{error:{code:closeError}}));return;
  }
  if (/^\/api\/admin\/e-voting\/[^/]+\/students\/search$/.test(path)) {
    const q=new URL(request.url,'http://localhost').searchParams.get('q')??'';
    const data=q.length<2?[]:[0,1].map(i=>({id:'20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),name:'Siswa Pilihan '+(i+1),nisn:'990000000'+i,className:'X QA'}));
    response.writeHead(200,{'Content-Type':'application/json','X-CSRF-Token':'synthetic-candidate-csrf'});response.end(JSON.stringify({data}));return;
  }
  if (/^\/api\/admin\/e-voting\/[^/]+\/candidates(?:\/[^/]+)?$/.test(path)) {
    let raw='';for await(const chunk of request)raw+=chunk;
    candidateMutations.push({path,method:request.method,body:JSON.parse(raw),csrf:request.headers['x-csrf-token']});
    response.writeHead(409,{'Content-Type':'application/json'});response.end(JSON.stringify({error:{code:candidateMutationCode}}));return;
  }
  if((path==='/api/admin/e-voting/types'||path.startsWith('/api/admin/e-voting/types/'))&&request.method!=='GET'){
    let raw='';for await(const chunk of request)raw+=chunk;
    typeMutations.push({path,method:request.method,body:JSON.parse(raw),csrf:request.headers['x-csrf-token']});
    const code=request.method==='DELETE'?'TYPE_IN_USE':request.method==='POST'?'DUPLICATE_TYPE':'STALE_CONFIG';
    response.writeHead(typeMutationMode==='success'?200:409,{'Content-Type':'application/json'});response.end(JSON.stringify(typeMutationMode==='success'?{data:{}}:{error:{code}}));return;
  }
  if(/^\/api\/admin\/e-voting\/[^/]+\/contests$/.test(path)&&request.method==='PUT'){
    let raw='';for await(const chunk of request)raw+=chunk;
    contestMutations.push({body:JSON.parse(raw),csrf:request.headers['x-csrf-token']});
    response.writeHead(contestMutationMode==='success'?200:409,{'Content-Type':'application/json'});response.end(JSON.stringify(contestMutationMode==='success'?{data:{}}:{error:{code:contestMutationMode==='stale'?'STALE_CONFIG':'CONTEST_HAS_CANDIDATES'}}));return;
  }
  if(path==='/api/admin/e-voting/types'){
    const query=new URL(request.url,'http://localhost').searchParams;typeRequests.push(query.toString());
    const after=query.has('cursor');let data=typeFixtureMode==='empty'?[]:typeFixture.slice(after?100:0,after?101:100);
    if(typeFixtureMode==='retained')data=data.filter(item=>item.code!=='OSIS').map(item=>({...item,name:'Updated master '+item.name}));
    response.writeHead(typeFixtureMode==='unavailable'?503:200,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-CSRF-Token':'synthetic-type-csrf'});
    response.end(JSON.stringify({data:{data,nextCursor:!after&&['normal','retained'].includes(typeFixtureMode)?'fixture-page-2':null}}));return;
  }
  if(path==='/api/admin/e-voting/periods'&&request.method==='POST'){
    let body='';for await(const chunk of request){body+=chunk;if(body.length>16384)throw new Error('Fixture body too large')}
    periodRequests.push({body:JSON.parse(body),csrf:request.headers['x-csrf-token']});
    response.writeHead(409,{'Content-Type':'application/json','Cache-Control':'private, no-store'});response.end(JSON.stringify({error:{code:'DUPLICATE_SLUG'}}));return;
  }
  if(path.startsWith('/api/image/qa/')){
    const start=performance.now();
    const result=await imageResponse(new Request(origin+request.url),path.slice('/api/image/'.length),async()=>({bytes:await readFile(resolve(fixtureRoot,path.includes('portrait')?'assets/kepala-sekolah.png':path.includes('/logo-')?'assets/logo.png':'assets/hero-siswa.png')),contentType:'image/png'}));
    const body=Buffer.from(await result.arrayBuffer());
    imageRenders.push({url:request.url,ms:Number((performance.now()-start).toFixed(1)),bytes:body.length});
    response.writeHead(result.status,Object.fromEntries(result.headers));response.end(body);return;
  }
  const file=resolve(fixtureRoot,'.'+(path==='/'?'/index.html':extname(path)?path:path+'/index.html'));
  if(!file.startsWith(fixtureRoot+sep)){response.writeHead(403).end();return}
  const body=await readFile(file);response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');response.end(body);
}catch{response.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const artifactRoot=resolve('artifacts/ui-qa');
await mkdir(artifactRoot,{recursive:true});
const profile=await mkdtemp(resolve(artifactRoot,'browser-'));
const browser=spawn(process.env.UI_QA_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1366,768','about:blank'],{windowsHide:true,stdio:'ignore'});
browser.on('error',error=>{console.error(error.message)});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const outcomes=[],errors=[],fontRequests=[],embedRequests=[];let socket;let id=0;const pending=new Map();
async function waitFor(fn,label){for(let i=0;i<100;i++){try{if(await fn())return}catch{}await delay(100)}throw new Error('Timed out: '+label)}
async function cdp(method,params={}){const callId=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(callId);reject(new Error('CDP timeout '+method))},10000);pending.set(callId,{resolve:result=>{clearTimeout(timer);resolve(result)},reject});socket.send(JSON.stringify({id:callId,method,params}))})}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression:'(()=>eval('+JSON.stringify(expression)+'))()',returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value}
async function navigate(url){
  await cdp('Page.navigate',{url});
  // SSR markup can appear before the module scripts attach event handlers.
  await waitFor(()=>evaluate("document.readyState==='complete'"),'page scripts ready');
}
const check=(name,fn)=>fn().then(()=>outcomes.push({name,passed:true}));
try{
 let target;await waitFor(async()=>{const port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];const list=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=list.find(item=>item.type==='page');return !!target},'browser launch');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const call=pending.get(message.id);pending.delete(message.id);if(message.error)call?.reject(new Error(message.error.message));else call?.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);else if(message.method==='Network.requestWillBeSent'){const url=message.params.request.url;if(/fonts\.(?:googleapis|gstatic)\.com|\.woff2/.test(url))fontRequests.push(url);if(/youtube(?:-nocookie)?\.com\/embed|google\.com\/maps\/embed/.test(url))embedRequests.push(url)}});
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
 // Fonts must work locally even when Google Fonts cannot be reached.
 await cdp('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
 await navigate(origin+'/');
 await waitFor(()=>evaluate("document.querySelector('[data-ui-table]')?.dataset.initialized==='true'"),'fixture and bundled JS');
 await check('default table renders 10/31 rows',async()=>{assert.equal(await evaluate("document.querySelectorAll('tbody tr:not([hidden])').length"),10)});
 await check('search and empty state',async()=>{await evaluate("const q=document.querySelector('[data-table-search]');q.value='Siswa Simulasi 31';q.dispatchEvent(new Event('input'));");assert.equal(await evaluate("document.querySelectorAll('tbody tr:not([hidden])').length"),1);await evaluate("const q=document.querySelector('[data-table-search]');q.value='missing fixture';q.dispatchEvent(new Event('input'));");assert.equal(await evaluate("document.querySelector('[data-table-empty]').hidden"),false);await evaluate("const q=document.querySelector('[data-table-search]');q.value='';q.dispatchEvent(new Event('input'));")});
 await check('filter and page size',async()=>{await evaluate("const f=document.querySelector('[data-table-filter]');f.value='X DKV';f.dispatchEvent(new Event('change'));const s=document.querySelector('[data-table-size]');s.value='25';s.dispatchEvent(new Event('change'));");assert.equal(await evaluate("document.querySelectorAll('tbody tr:not([hidden])').length"),16);await evaluate("const f=document.querySelector('[data-table-filter]');f.value='';f.dispatchEvent(new Event('change'));")});
 await check('natural sorting and selection survives paging',async()=>{await evaluate("document.querySelectorAll('thead th')[1].querySelector('button').click();document.querySelector('tbody input[value=\"1\"]').checked=true;document.querySelector('[data-table-next]').click();");assert.equal(await evaluate("document.querySelectorAll('tbody tr:not([hidden])').length"),6);assert.equal(await evaluate("document.querySelector('tbody input[value=\"1\"]').checked"),true);await evaluate("document.querySelector('[data-table-prev]').click()")});
 await check('confirmation cancel and confirm',async()=>{await evaluate("document.querySelector('#qa-confirm').click()");assert.equal(await evaluate("document.querySelector('#action-confirm-dialog').open"),true);await evaluate("document.querySelector('#action-confirm-dialog').close('cancel')");await delay(80);assert.equal(await evaluate("document.querySelector('#qa-feedback').textContent"),'Dibatalkan');await evaluate("document.querySelector('#qa-confirm').click();document.querySelector('#action-confirm-dialog').close('confirm')");await delay(80);assert.equal(await evaluate("document.querySelector('#qa-feedback').textContent"),'Dikonfirmasi')});
 await check('test cleanup requires two confirmations, clears passwords and rejects a stale preview',async()=>{
   await evaluate(`window.qaCleanupPosts=0;const original=window.fetch;window.fetch=async(url,options)=>{if(!String(url).endsWith('/test-cleanup'))return original(url,options);if(options?.method==='POST'){window.qaCleanupPosts++;return new Response(JSON.stringify({error:{code:window.qaCleanupPosts===1?'INVALID_REAUTH':'STALE_CLEANUP_PREVIEW'}}),{status:window.qaCleanupPosts===1?401:409,headers:{'Content-Type':'application/json'}})}return new Response(JSON.stringify({data:{id:'10000000-0000-4000-8000-000000000001',slug:'periode-uji',version:'a'.repeat(32),contests:4,candidates:4,members:8,voters:2,pins:2,participation:8,ballots:2,sessions:1,auditEvents:3}}),{status:200,headers:{'Content-Type':'application/json','X-CSRF-Token':'fixture-token'}})};document.querySelector('[data-cleanup-open]').click()`);
   await waitFor(()=>evaluate("document.querySelector('[data-cleanup-preview]').open"),'cleanup preview');
   await evaluate("document.querySelector('[data-cleanup-preview] [data-cleanup-cancel]').click()");assert.equal(await evaluate('window.qaCleanupPosts'),0);
   await evaluate("document.querySelector('[data-cleanup-open]').click()");await waitFor(()=>evaluate("document.querySelector('[data-cleanup-preview]').open"),'new cleanup preview');
   await evaluate("document.querySelector('[data-cleanup-next]').click()");assert.equal(await evaluate("document.querySelector('[data-cleanup-verify]').open"),true);
   await evaluate("const f=document.querySelector('[data-cleanup-form]');f.elements.confirmation.value='HAPUS wrong';f.elements.adminPassword.value='synthetic-password';f.dispatchEvent(new Event('input',{bubbles:true}))");
   assert.equal(await evaluate("document.querySelector('[data-cleanup-submit]').disabled"),true);
   await evaluate("const f=document.querySelector('[data-cleanup-form]');f.elements.confirmation.value='HAPUS periode-uji';f.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-cleanup-submit]').click()");
   await waitFor(()=>evaluate("!document.querySelector('[data-cleanup-error]').hidden"),'wrong password feedback');
   assert.equal(await evaluate("document.querySelector('[data-cleanup-form]').elements.adminPassword.value"),'');
   await evaluate("const f=document.querySelector('[data-cleanup-form]');f.elements.adminPassword.value='synthetic-password';f.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-cleanup-submit]').click()");
   await waitFor(()=>evaluate("!document.querySelector('[data-cleanup-verify]').open"),'stale preview closes verification');
   assert.equal(await evaluate("document.querySelector('[data-cleanup-message]').textContent.includes('Data periode berubah')"),true);
   assert.equal(await evaluate('window.qaCleanupPosts'),2);
 });
 await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 await writeFile(resolve(artifactRoot,'desktop.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await check('mobile drawer keyboard and page overflow',async()=>{await waitFor(()=>evaluate("document.querySelector('#sidebar').inert"),'mobile breakpoint handler');assert.equal(await evaluate("document.querySelector('#menu-btn').getBoundingClientRect().width>0"),true);await evaluate("document.querySelector('#menu-btn').click()");assert.equal(await evaluate("document.querySelector('.main-content').inert"),true);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate("document.querySelector('#menu-btn').getAttribute('aria-expanded')"),'false');await waitFor(()=>evaluate("document.querySelector('#sidebar').getBoundingClientRect().right<=1"),'drawer animation');assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),true)});
 await writeFile(resolve(artifactRoot,'mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
 await check('tablet content stays within the viewport',async()=>{assert.equal(await evaluate("document.querySelector('.main-content').getBoundingClientRect().width<=window.innerWidth+1"),true);assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),true)});
 await navigate(origin+'/student');
 await waitFor(()=>evaluate("document.body.dataset.periodId==='qa-period'"),'student fixture');
 await check('student session extension refreshes CSRF and logout clears private UI',async()=>{
   await evaluate("window.fetch=async(url)=>new Response(String(url).endsWith('/logout')?null:JSON.stringify({csrfToken:'qa-csrf-updated',idleExpiresAt:new Date(Date.now()+120000).toISOString()}),{status:String(url).endsWith('/logout')?204:200,headers:{'Content-Type':'application/json'}});document.querySelector('#extend-session').click()");
   await waitFor(()=>evaluate("document.body.dataset.csrf==='qa-csrf-updated'"),'CSRF refresh');
   assert.notEqual(await evaluate("document.querySelector('#session-expiry').textContent"),'Awal');
   await evaluate("document.querySelector('#logout-button').click()");await waitFor(()=>evaluate("location.pathname==='/siswa/masuk'"),'logout navigation');
   assert.equal(await evaluate("document.body.textContent.includes('Portal Siswa — fixture sintetis')"),false);
 });
 await check('expired student session removes private screen and returns to login',async()=>{
   await navigate(origin+'/student-expired');await waitFor(()=>evaluate("location.pathname==='/siswa/masuk'&&location.search==='?expired=1'"),'expiry navigation');
   assert.equal(await evaluate("document.body.textContent.includes('Tampilan privat fixture')"),false);
 });
 await check('teacher portal uses its own credentials and dashboard, extension, logout and completion routes',async()=>{
   const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.fetch=async(url,options)=>{
     if(String(url).endsWith('/session')) {
       if(options?.method==='POST'){sessionStorage.setItem('qaTeacherPayload',options.body);return new Response(JSON.stringify({redirectTo:'/pemilih'}));}
       return new Response(JSON.stringify({csrfToken:'qa-preauth',phase:'OPEN'}));
     }
     return new Response(String(url).endsWith('/logout')?null:JSON.stringify({csrfToken:'qa-teacher-updated',idleExpiresAt:new Date(Date.now()+120000).toISOString()}),{status:String(url).endsWith('/logout')?204:200});
   }`});
   await navigate(origin+'/pemilih/masuk');
   await waitFor(()=>evaluate("document.querySelector('#submit')?.disabled===false"),'teacher preauth');
   assert.equal(await evaluate("document.querySelector('#identifier').maxLength"),17);
   assert.equal(await evaluate("document.querySelector('h1').textContent"),'Masuk ke Portal Pemilih');
   await evaluate("document.querySelector('#identifier').value='GURU-ABCDEF123456';document.querySelector('#pin').value='0011223344';document.querySelector('#submit').click()");
   await waitFor(()=>evaluate("location.pathname==='/pemilih'&&document.body.dataset.portalBase==='/pemilih'"),'teacher dashboard');
   assert.deepEqual(JSON.parse(await evaluate("sessionStorage.getItem('qaTeacherPayload')")),{voterType:'TEACHER',code:'GURU-ABCDEF123456',pin:'0011223344'});
   assert.equal(await evaluate("document.querySelector('a.button').getAttribute('href')"),'/pemilih/e-voting/mixed/pilih');
   assert.equal(await evaluate("document.querySelectorAll('.coming').length"),0);
   await evaluate("document.querySelector('#extend-session').click()");
   await waitFor(()=>evaluate("document.body.dataset.csrf==='qa-teacher-updated'"),'teacher extension');
   await evaluate("document.querySelector('#logout-button').click()");
   await waitFor(()=>evaluate("location.pathname==='/pemilih/masuk'"),'teacher logout');
   await navigate(origin+'/pemilih/selesai');
   await waitFor(()=>evaluate("document.querySelector('h1')?.textContent==='Pemilihan Anda telah selesai'"),'teacher completion');
   assert.equal(await evaluate("document.querySelector('main a').getAttribute('href')"),'/pemilih/masuk');
   assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),true);
   await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});
 });
 await check('expired draft shows roster actions; student choices survive paging and preview sends only selected IDs',async()=>{
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
   await navigate(origin+'/admin/e-voting/10000000-0000-4000-8000-000000000001/pemilih');
   await waitFor(()=>evaluate("document.querySelector('#student-roster [data-ui-table]')?.dataset.initialized==='true'"),'draft roster');
   assert.equal(await evaluate("!!document.querySelector('#preview-student-roster')&&!!document.querySelector('#preview-teacher-roster')"),true);
   assert.equal(await evaluate("document.querySelector('.feedback[data-tone=warning]').textContent.includes('DRAFT')"),true);
   assert.equal(await evaluate("document.querySelectorAll('#student-roster tbody tr:not([hidden])').length"),10);
   await evaluate("document.querySelector('#student-roster .student-choice').click();document.querySelector('#student-roster [data-table-next]').click();document.querySelector('#student-roster tbody tr:not([hidden]) .student-choice').click();document.querySelector('#preview-student-roster').click()");
   assert.equal(await evaluate("document.querySelector('#student-selected-count').textContent"),'2 siswa dipilih');
   assert.equal(await evaluate("document.querySelector('#sync-student-roster').disabled"),false);
   assert.equal(await evaluate("document.querySelector('#student-roster-preview').textContent.includes('2/99')"),true);
   await evaluate(`window.qaStudentPosts=[];window.fetch=async(url,options)=>{if(options?.method==='POST'){window.qaStudentPosts.push(JSON.parse(options.body));return new Response(JSON.stringify({error:{code:'STUDENT_NOT_ELIGIBLE'}}),{status:404});}return new Response('{}',{status:200});};document.querySelector('#sync-student-roster').click()`);
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog')?.open"),'student confirmation');
   await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>evaluate("window.qaStudentPosts.length===1"),'selected student request');
   assert.equal((await evaluate('window.qaStudentPosts[0].studentIds')).length,2);
   assert.deepEqual(Object.keys(await evaluate('window.qaStudentPosts[0]')),['studentIds']);
   await waitFor(()=>evaluate("document.querySelector('#student-roster-preview').textContent.includes('tahun ajaran kelas berubah')"),'changed master feedback');
   await evaluate("document.querySelector('#student-select-all').click()");
   assert.equal(await evaluate("document.querySelector('#student-selected-count').textContent"),'31 siswa dipilih');
   assert.equal(await evaluate("document.querySelector('#sync-student-roster').disabled"),true);
   await evaluate("document.querySelector('#preview-student-roster').click()");
   assert.equal(await evaluate("document.querySelector('#student-roster-preview').textContent.includes('31/99')"),true);
   await navigate(origin+'/admin/e-voting/10000000-0000-4000-8000-000000000002/pemilih');
   await waitFor(()=>evaluate("document.querySelector('.feedback[data-tone=info]')?.textContent.includes('terkunci')"),'opened roster notice');
   assert.equal(await evaluate("document.querySelector('#student-roster')===null&&document.querySelector('#teacher-roster')===null"),true);
 });
 await check('public images load responsive variants at desktop/mobile DPR 1/2; favicon and profile use optimized files',async()=>{
   await cdp('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*youtube.com*','*google.com/maps*']});
   await cdp('Network.setCacheDisabled',{cacheDisabled:true});
   const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.fetch=async()=>new Response('[]',{headers:{'Content-Type':'application/json'}})"});
   for(const width of [1366,390])for(const dpr of [1,2]){
     await navigate('about:blank');
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:dpr,mobile:false});
     await navigate(origin+'/public-home');
     await waitFor(()=>evaluate("document.querySelector('img[fetchpriority=high]')?.complete&&document.querySelector('img[fetchpriority=high]').naturalWidth>0"),'responsive hero');
     assert.equal(await evaluate("getComputedStyle(document.querySelector('header img')).width"),'40px');
     const hero=await evaluate("({src:document.querySelector('img[fetchpriority=high]').currentSrc,loading:document.querySelector('img[fetchpriority=high]').loading})");
     assert.equal(hero.loading,'eager');
     assert.ok(hero.src.endsWith(`/assets/hero-siswa-${dpr===1?480:width===390?768:947}-v1.webp`),hero.src);
     assert.equal(await evaluate("document.querySelector('link[rel=icon]').getAttribute('href')"),'/assets/favicon-v1.png');
     assert.equal(await evaluate("document.querySelectorAll('header img[src=\"/assets/logo-v1.webp\"],footer img[src=\"/assets/logo-v1.webp\"]').length"),2);
     await evaluate("document.querySelector('img[alt*=\"Kepala\"]').scrollIntoView()");
     await waitFor(()=>evaluate("[...document.querySelectorAll('header img,footer img,img[fetchpriority=high],img[alt*=\"Kepala\"]')].every(i=>i.complete&&i.naturalWidth>0)"),'public images decoded');
     await evaluate('document.fonts.ready.then(()=>true)');
     assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
     await evaluate('scrollTo(0,0)');
     await writeFile(resolve(artifactRoot,`public-home-${width}-${dpr}x.png`),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   }
   await navigate(origin+'/public-profile');
   await waitFor(()=>evaluate("!!document.querySelector('img[alt*=\"Kepala\"]')"),'profile image');
   await evaluate("document.querySelector('img[alt*=\"Kepala\"]').scrollIntoView()");
   await waitFor(()=>evaluate("document.querySelector('img[alt*=\"Kepala\"]').complete&&document.querySelector('img[alt*=\"Kepala\"]').naturalWidth>0"),'profile image decoded');
   assert.ok((await evaluate("document.querySelector('img[alt*=\"Kepala\"]').currentSrc")).includes('/assets/kepala-sekolah-'));
   await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});
 });
 await check('local text and subset fonts render every catalog icon; custom CMS icons and picker use the full fallback',async()=>{
   const icons=JSON.parse(await readFile(resolve('src/data/font-icons.json'),'utf8'));
   assert.ok(!icons.includes('vacuum'),'Fixture exercises a name outside the subset');
   const missing=await evaluate(`(async()=>{await document.fonts.load('500 24px "Material Symbols Outlined"');await document.fonts.ready;const c=document.createElement('canvas').getContext('2d');c.font='500 24px "Material Symbols Outlined"';return ${JSON.stringify(icons)}.filter(name=>Math.abs(c.measureText(name).width-24)>0.1)})()`);
   assert.deepEqual(missing,[],'Every subset name must form a single icon glyph');
   const resources=await evaluate("performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.woff2')).map(r=>({url:r.name,bytes:r.encodedBodySize}))");
   assert.ok(resources.some(r=>r.url.endsWith('/fonts/plus-jakarta-sans-latin-v1.woff2')&&r.bytes>0));
   assert.ok(resources.some(r=>r.url.endsWith('/fonts/material-symbols-subset-v1.woff2')&&r.bytes>0&&r.bytes<=30000));
   assert.equal(resources.some(r=>r.url.includes('material-symbols-full')),false);
   await navigate(origin+'/student');
   await waitFor(()=>evaluate("location.pathname==='/student'&&document.body.classList.contains('student-portal')"),'student font scope');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate("performance.getEntriesByType('resource').some(r=>r.name.includes('material-symbols'))"),false,'Student portal needs no icon font');
   await cdp('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*youtube.com*','*google.com/maps*','*images.unsplash.com*']});
   await navigate(origin+'/public-facilities');
   await waitFor(()=>evaluate("[...document.querySelectorAll('.material-symbols-outlined')].some(e=>e.textContent==='vacuum')"),'custom CMS icon');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate(`(()=>{const c=document.createElement('canvas').getContext('2d');c.font='500 24px "Material Symbols Outlined"';return c.measureText('vacuum').width})()`),24);
   assert.ok(await evaluate("performance.getEntriesByType('resource').some(r=>r.name.endsWith('/fonts/material-symbols-full-v1.woff2'))"));
   await navigate(origin+'/');
   await waitFor(()=>evaluate("document.querySelector('.icon-picker')?.dataset.wired==='true'"),'icon picker initialized');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.ok(await evaluate("performance.getEntriesByType('resource').some(r=>r.name.endsWith('/fonts/material-symbols-full-v1.woff2'))"));
   await evaluate("document.querySelector('.ip-input').value='vacuum';document.querySelector('.ip-input').dispatchEvent(new Event('input'));document.querySelector('.ip-open').click()");
   assert.equal(await evaluate("document.querySelector('.ip-preview').textContent"),'vacuum');
   await evaluate("document.querySelector('.ip-search').value='masjid';document.querySelector('.ip-search').dispatchEvent(new Event('input'));document.querySelector('.ip-cell[data-name=mosque]').click()");
   assert.equal(await evaluate("document.querySelector('.ip-input').value"),'mosque');
   assert.equal(await evaluate("document.querySelector('.ip-modal').style.display"),'none');
   assert.equal(fontRequests.some(url=>/fonts\.(?:googleapis|gstatic)\.com/.test(url)),false,'No Google font requests');
 });
 await check('video/map request nothing before activation; keyboard starts one iframe without resizing; fallback links work without scripts',async()=>{
   await cdp('Network.setBlockedURLs',{urls:['*youtube*','*google.com/maps*']});
   for(const width of [1366,390]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
     await navigate('about:blank');embedRequests.length=0;
     await navigate(origin+'/public-home');
     await waitFor(()=>evaluate("document.querySelectorAll('[data-embed-start]:not(:disabled)').length===2"),'embed controls initialized');
     await evaluate('document.fonts.ready.then(()=>true)');
     for(const kind of ['video','map'])await evaluate(`document.querySelector('[data-kind=${kind}]').scrollIntoView()`);
     assert.equal(await evaluate('document.querySelectorAll("iframe").length'),0);
     assert.deepEqual(embedRequests,[],'Scrolling must not load players/maps');
     for(const kind of ['video','map']){
       await evaluate(`document.querySelector('[data-kind=${kind}]').scrollIntoView()`);
       const before=await evaluate(`document.querySelector('[data-kind=${kind}] [data-embed-stage]').getBoundingClientRect().height`);
       await writeFile(resolve(artifactRoot,`embed-${kind}-${width}.png`),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
       await cdp('Page.bringToFront');
       await evaluate(`document.querySelector('[data-kind=${kind}] button').focus()`);
       assert.equal(await evaluate(`document.activeElement===document.querySelector('[data-kind=${kind}] button')`),true,'Embed button receives focus');
       await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
       await cdp('Input.dispatchKeyEvent',{type:'char',text:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
       await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
       await waitFor(()=>evaluate(`!!document.querySelector('[data-kind=${kind}] iframe')`),'keyboard activation');
       assert.equal(await evaluate(`document.querySelector('[data-kind=${kind}] [data-embed-stage]').getBoundingClientRect().height`),before);
       assert.equal(await evaluate(`document.querySelectorAll('[data-kind=${kind}] iframe').length`),1);
       assert.equal(await evaluate(`document.activeElement===document.querySelector('[data-kind=${kind}] iframe')`),true);
       assert.ok(await evaluate(`!!document.querySelector('[data-kind=${kind}] iframe').title`));
       assert.ok(await evaluate(`document.querySelector('[data-kind=${kind}] .embed-fallback').href.startsWith('https://')`));
     }
     await waitFor(()=>Promise.resolve(embedRequests.length===2),'two activated embed requests');
     assert.ok(embedRequests.some(url=>url.includes('youtube-nocookie.com/embed/pW8MRWOVfUQ?autoplay=1')));
   }
   await cdp('Emulation.setScriptExecutionDisabled',{value:true});
   try{
     await navigate(origin+'/public-home');
     await waitFor(()=>evaluate("document.querySelectorAll('.embed-fallback').length===2"),'no-script links');
     assert.equal(await evaluate('document.querySelectorAll("iframe").length'),0);
     assert.equal(await evaluate("new URL(document.querySelector('[data-kind=map] .embed-fallback').href).searchParams.get('query')"),'SMK NU Darul Hikam Karanggeneng');
   }finally{await cdp('Emulation.setScriptExecutionDisabled',{value:false});}
 });
 await check('server announcement avoids a second fetch, pauses rotation on focus, persists dismissal and never moves the page',async()=>{
   await evaluate("localStorage.removeItem('smkdh_announce_dismissed')");
   const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.qaFetches=0;window.fetch=async()=>{window.qaFetches++;return new Response('[]')};const originalInterval=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===6000)window.qaRotate=fn;return originalInterval(fn,ms,...args)}"});
   await navigate(origin+'/public-home');
   await waitFor(()=>evaluate("!!window.qaRotate&&!document.querySelector('#announce-bar').hidden"),'server announcement');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate('window.qaFetches'),0);
   const top=await evaluate("document.querySelector('main').getBoundingClientRect().top");
   const first=await evaluate("document.querySelector('#announce-text').textContent");
   await evaluate("document.querySelector('#announce-msg').focus();window.qaRotate()");
   assert.equal(await evaluate("document.querySelector('#announce-text').textContent"),first);
   await evaluate("document.querySelector('header a').focus();document.querySelector('#announce-bar').dispatchEvent(new Event('mouseleave'));window.qaRotate()");
   assert.notEqual(await evaluate("document.querySelector('#announce-text').textContent"),first);
   assert.equal(await evaluate("document.querySelector('main').getBoundingClientRect().top"),top);
   await evaluate("document.querySelector('#announce-close').click()");
   assert.equal(await evaluate("document.querySelector('#announce-bar').hidden"),true);
   assert.equal(await evaluate("document.querySelector('main').getBoundingClientRect().top"),top);
   await cdp('Page.reload');
   await waitFor(()=>evaluate("document.readyState==='complete'&&!!document.querySelector('#announce-bar')"),'dismissed reload');
   assert.equal(await evaluate("document.querySelector('#announce-bar').hidden"),true);
   await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});
 });
 await check('delayed/new/long announcements stay within mobile viewport, expire, and close when storage is blocked; empty/error responses stay hidden',async()=>{
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:1,mobile:false});
   const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.fetch=async()=>{await new Promise(resolve=>window.qaRelease=resolve);return new Response(JSON.stringify([{id:'qa-new',text:'Pengumuman panjang '.repeat(150),linkUrl:'javascript:alert(1)',expiresAt:new Date(Date.now()+2500).toISOString()}]),{headers:{'Content-Type':'application/json'}})}"});
   await navigate(origin+'/public-profile');
   await waitFor(()=>evaluate('!!window.qaRelease'),'deferred announcement');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate("document.querySelector('#announce-bar').hidden"),true);
   const top=await evaluate("document.querySelector('main').getBoundingClientRect().top");
   await evaluate('window.qaRelease()');
   await waitFor(()=>evaluate("!document.querySelector('#announce-bar').hidden"),'new set ignores previous dismissal');
   assert.equal(await evaluate("document.querySelector('main').getBoundingClientRect().top"),top);
   assert.equal(await evaluate("document.querySelector('#announce-link').hasAttribute('href')"),false);
   assert.equal(await evaluate("document.querySelector('#announce-msg').scrollHeight>document.querySelector('#announce-msg').clientHeight"),true);
   assert.equal(await evaluate("document.querySelector('#announce-bar').getBoundingClientRect().right<=innerWidth&&document.querySelector('#announce-bar').getBoundingClientRect().top>=0"),true);
   await writeFile(resolve(artifactRoot,'announcement-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await waitFor(()=>evaluate("document.querySelector('#announce-bar').hidden"),'announcement expiry');
   assert.equal(await evaluate("document.querySelector('main').getBoundingClientRect().top"),top);
   await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});
   for(const mode of ['empty','error','storage']){
     const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:mode==='storage'?"Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked')}});window.fetch=async()=>new Response(JSON.stringify([{id:'blocked-storage',text:'Tetap dapat ditutup'}]))":`window.fetch=async()=>new Response('[]',{status:${mode==='error'?503:200}})`});
     await navigate(origin+'/public-profile');
     await waitFor(()=>evaluate("document.readyState==='complete'&&!!document.querySelector('#announce-bar')"),'announcement response');
     if(mode==='storage'){
       await waitFor(()=>evaluate("!document.querySelector('#announce-bar').hidden"),'storage fallback');
       await evaluate("document.querySelector('#announce-close').click()");
     }
     assert.equal(await evaluate("document.querySelector('#announce-bar').hidden"),true);
     await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});
   }
 });
 await check('CMS cards select responsive thumbnails across public pages at DPR 1/2 and preserve gallery originals',async()=>{
   await cdp('Network.setCacheDisabled',{cacheDisabled:false});
   for(const dpr of [1,2]){
     await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:dpr,mobile:false});
     for(const page of ['home','news','gallery','teachers','facilities','achievements','departments','extracurricular','partners','alumni']){
       await navigate(origin+'/public-'+page);
       await waitFor(()=>evaluate("document.readyState==='complete'&&!!document.querySelector('main img[srcset][src*=\"/api/image/qa/\"]')"),'CMS '+page);
       const count=await evaluate("document.querySelectorAll('main img[srcset][src*=\"/api/image/qa/\"]').length");
       if(page==='news')assert.equal(count,3,'existing thumbnail URLs still need responsive alternatives');
       for(let index=0;index<count;index++){
         await evaluate(`document.querySelectorAll('main img[srcset][src*="/api/image/qa/"]')[${index}].scrollIntoView({block:'center'})`);
         await waitFor(()=>evaluate(`(()=>{const img=document.querySelectorAll('main img[srcset][src*="/api/image/qa/"]')[${index}];return img.complete&&img.naturalWidth>0})()`),'CMS decoded '+page);
       }
       const images=await evaluate("[...document.querySelectorAll('main img[srcset][src*=\"/api/image/qa/\"]')].map(i=>({src:i.currentSrc,lazy:i.loading,sizes:i.sizes,width:i.getBoundingClientRect().width,natural:i.naturalWidth}))");
       for(const img of images){assert.match(img.src,/\/api\/image\/qa\/photo.jpg\?.*w=\d+/);assert.equal(img.lazy,'lazy');assert.ok(img.sizes);assert.ok(img.width>0);}
       if(page==='gallery')assert.equal(await evaluate("document.querySelector('main a[target=_blank]').getAttribute('href')"),'/api/image/qa/photo.jpg?version=2');
       assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,page+' overflow');
     }
   }
 });
 await check('thumbnail cold render and warm browser hit use the real handler with normal caching',async()=>{
   await cdp('Network.clearBrowserCache');
   await cdp('Network.setCacheDisabled',{cacheDisabled:false});
   const probe='/api/image/qa/cache.jpg?w=600';
   const before=imageRenders.filter(r=>r.url===probe).length;
   const first=await evaluate(`fetch('${probe}').then(async r=>({bytes:(await r.arrayBuffer()).byteLength,type:r.headers.get('Content-Type'),cache:r.headers.get('Cache-Control')}))`);
   assert.equal(first.type,'image/webp');assert.match(first.cache,/immutable/);
   const second=await evaluate(`fetch('${probe}').then(async r=>(await r.arrayBuffer()).byteLength)`);
   assert.equal(second,first.bytes);
   assert.equal(imageRenders.filter(r=>r.url===probe).length,before+1,'warm request must not render again');
   const timings=await evaluate(`performance.getEntriesByName(location.origin+'${probe}').map(r=>({ms:r.duration,transferred:r.transferSize}))`);
   assert.equal(timings.length,2);assert.equal(timings[1].transferred,0);
   await writeFile(resolve(artifactRoot,'cms-thumbnail-cache.json'),JSON.stringify({scope:'loopback synthetic CMS fixture; local photo and Sharp, not R2/Vercel',cold:imageRenders.filter(r=>r.url===probe).at(-1),browser:timings},null,2));
 });
 await check('participation badges distinguish voted/pending and stay consistent after loading more rows',async()=>{
   await navigate(origin+'/admin/e-voting/10000000-0000-4000-8000-000000000001/partisipasi');
   await waitFor(()=>evaluate("document.querySelector('[data-ui-table]')?.dataset.initialized==='true'&&document.querySelectorAll('#voter-status-table tbody tr').length===3"),'participation fixture');
   const badge=selector=>evaluate(`(()=>{const badge=document.querySelector(${JSON.stringify(selector)}),cell=getComputedStyle(badge.closest('td'));return {text:badge.textContent,tone:badge.dataset.tone,icon:badge.querySelector('[aria-hidden=true]').textContent,color:getComputedStyle(badge).color,background:getComputedStyle(badge).backgroundColor,whiteSpace:cell.whiteSpace,padding:cell.padding}})()`);
   const done=await badge('#voter-status-table tbody tr:first-child td:nth-child(4) .status-badge');
   const pending=await badge('#voter-status-table tbody tr:last-child td:nth-child(4) .status-badge');
   assert.equal(done.text,'✓Sudah memilih');assert.equal(done.tone,'success');assert.equal(done.icon,'✓');
   assert.equal(pending.text,'○Belum memilih');assert.equal(pending.tone,'neutral');assert.equal(pending.icon,'○');
   assert.equal(done.whiteSpace,'nowrap');assert.equal(done.padding,'9px');
   assert.notEqual(done.color,pending.color);assert.notEqual(done.background,pending.background);
   assert.equal(await evaluate("document.querySelectorAll('#voter-status-table tbody tr:nth-child(2) .status-badge[data-tone=success]').length"),1);
   await evaluate(`window.fetch=async()=>new Response(JSON.stringify({data:{data:[{nisn:'9900000003',name:'<b>Pemilih aman</b>',className:'X DKV',participation:{OSIS:true,PRADANA_PUTRA:false,PRADANA_PUTRI:false,IPNU:true,IPPNU:false}}],nextCursor:null}}),{headers:{'Content-Type':'application/json'}});document.querySelector('#more-voters').click()`);
   await waitFor(()=>evaluate("document.querySelectorAll('#voter-status-table tbody tr').length===4&&document.querySelector('#more-voters').hidden"),'participation next page');
   assert.deepEqual(await badge('#voter-status-table tbody tr:last-child td:nth-child(4) .status-badge'),done);
   assert.deepEqual(await badge('#voter-status-table tbody tr:last-child td:nth-child(5) .status-badge'),pending);
   assert.equal(await evaluate("document.querySelector('#voter-status-table tbody tr:last-child td:nth-child(2)').textContent"),'<b>Pemilih aman</b>');
   assert.equal(await evaluate("document.querySelector('#voter-status-table tbody tr:last-child td:nth-child(2) b')"),null);
   const q="document.querySelector('[data-table-search]')";
   await evaluate(`${q}.value='Pemilih aman';${q}.dispatchEvent(new Event('input'))`);
   assert.equal(await evaluate("document.querySelectorAll('#voter-status-table tbody tr:not([hidden])').length"),1);
   await evaluate(`${q}.value='';${q}.dispatchEvent(new Event('input'))`);
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
   await evaluate("document.querySelector('#voter-status-table').scrollIntoView({block:'center'})");
   await writeFile(resolve(artifactRoot,'participation-desktop.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
   await waitFor(()=>evaluate("document.querySelector('#sidebar').getBoundingClientRect().right<=1"),'participation mobile drawer closed');
   await evaluate("document.querySelector('#voter-status-table').scrollIntoView({block:'center'});const region=document.querySelector('[data-ui-table] .table-region');region.scrollLeft=region.scrollWidth");
   await writeFile(resolve(artifactRoot,'participation-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 });
 await check('period creation loads paginated live types, submits explicit selections and keeps failed/empty forms disabled',async()=>{
   await navigate(origin+'/admin/e-voting');
   await waitFor(()=>evaluate("document.querySelector('#period-type-options')?.children.length===101&&!document.querySelector('#period-form button[type=submit]').disabled"),'all type pages');
   assert.equal(typeRequests.length,2);
   assert.deepEqual(await evaluate("[...document.querySelectorAll('#period-type-options input:checked')].map(input=>input.value)"),['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPNU','IPPNU']);
   assert.equal(await evaluate("document.querySelector('#period-type-options label:last-child b')"),null);
   assert.equal(await evaluate("document.querySelector('#period-type-options input[value=SIXTH_NEW]').closest('label').lastElementChild.textContent"),'<b>Jenis tambahan</b>');
   await evaluate("const form=document.querySelector('#period-form');form.closest('details').open=true;for(const [name,value]of Object.entries({slug:'qa-period',name:'QA period',academicYear:'2026/2027',opensAt:'2035-01-01T08:00',closesAt:'2035-01-01T10:00'}))form.elements.namedItem(name).value=value;document.querySelectorAll('#period-type-options input').forEach(input=>input.checked=input.value==='SIXTH_NEW');form.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#period-message')?.textContent==='Slug periode sudah digunakan.'"),'period API feedback');
   assert.deepEqual(periodRequests[0].body.organizations,['SIXTH_NEW']);assert.equal(periodRequests[0].csrf,'synthetic-type-csrf');
   for(const mode of ['empty','unavailable']){
     typeFixtureMode=mode;await navigate(origin+'/admin/e-voting');
     const label=mode==='empty'?'Belum ada jenis':'belum berhasil dimuat';
     await waitFor(()=>evaluate("document.querySelector('#period-types-loading')?.textContent.includes("+JSON.stringify(label)+")"),'type list '+mode);
     assert.equal(await evaluate("document.querySelector('#period-form button[type=submit]').disabled"),true);
   }
   typeFixtureMode='normal';
 });
 await check('1/5/6 period types render matching dashboard, ballot progress and final vote on desktop/mobile',async()=>{
   for(const n of [1,5,6]){
     const code=n===1?'PRADANA_PUTRI':n===5?'IPPNU':'NEW_TYPE';
     await cdp('Emulation.setDeviceMetricsOverride',{width:n===6?390:1366,height:900,deviceScaleFactor:1,mobile:false});
     await navigate(origin+'/voting/'+n+'/dashboard');
     await waitFor(()=>evaluate(`document.querySelector('[role=progressbar]')?.getAttribute('aria-valuemax')==='${n}'`),'dynamic dashboard '+n);
     assert.equal(await evaluate("document.querySelectorAll('.status-row').length"),n);
     assert.equal(await evaluate("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')"),String(n-1));
     await navigate(origin+'/voting/'+n);
     await waitFor(()=>evaluate(`document.querySelectorAll('.org-card').length===${n}`),'dynamic choices '+n);
     assert.equal(await evaluate("document.querySelectorAll('.org-card .done').length"),n-1);
     assert.equal(await evaluate("document.querySelector('.org-card a').getAttribute('href')"),'/siswa/e-voting/qa-'+n+'/pilih/'+code);
     await navigate(origin+'/voting/'+n+'/'+code);
     await waitFor(()=>evaluate("document.querySelector('#review-vote')?.disabled===false"),'dynamic ballot '+n);
     assert.equal(await evaluate("document.querySelector('.voting-progress progress').max"),n);
     assert.equal(await evaluate("document.querySelector('.voting-progress progress').value"),n-1);
     assert.equal(await evaluate("document.querySelector('.member strong').textContent"),'Siswa <b>aman</b>');
     assert.equal(await evaluate("document.querySelector('.member strong b')"),null);
     assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),true);
     await evaluate(`window.qaVotePayload=null;window.fetch=async(url,options)=>{window.qaVotePayload=JSON.parse(options.body);sessionStorage.setItem('qaVotePayload',options.body);return new Response(JSON.stringify({data:{complete:true,redirectTo:'/siswa/selesai'}}),{status:201,headers:{'Content-Type':'application/json'}})};document.querySelector('input[name=candidateId]').focus()`);
     await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
     await evaluate("document.querySelector('#review-vote').click()");
     assert.equal(await evaluate("document.querySelector('#confirm-dialog').open"),true);
     if(n===6)await writeFile(resolve(artifactRoot,'dynamic-ballot-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
     await evaluate("document.querySelector('#confirm-vote').click()");
     await waitFor(()=>evaluate("location.pathname==='/siswa/selesai'"),'completion '+n);
     assert.deepEqual(JSON.parse(await evaluate("sessionStorage.getItem('qaVotePayload')")),{organization:code,candidateId:'40000000-0000-4000-8000-000000000001'});
   }
 });
 await check('master types use dashboard pagination, popup modes, MediaPicker and guarded edit/toggle/delete',async()=>{
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
   await navigate(origin+'/admin/e-voting/jenis');
   await waitFor(()=>evaluate("document.querySelector('[data-ui-table]')?.dataset.initialized==='true'"),'type table');
   assert.equal(await evaluate("document.querySelectorAll('tbody tr:not([hidden])').length"),10);
   assert.equal(await evaluate("document.querySelectorAll('#sidebar a[aria-current=page]').length"),1);
   assert.equal(await evaluate("document.querySelector('#sidebar a[aria-current=page]').textContent.trim()"),'Jenis Pemilihan');
   await evaluate("document.querySelector('#add-election-type').click()");
   assert.equal(await evaluate("document.querySelector('#type-dialog').open"),true);
   assert.equal(await evaluate("document.querySelector('#vice-label-field').hidden"),true);
   await evaluate("const f=document.querySelector('#type-form');f.elements.code.value='NEW_TYPE';f.elements.name.value='Jenis baru';f.elements.candidateMode.value='OPTIONAL_VICE';f.elements.candidateMode.dispatchEvent(new Event('change'))");
   assert.equal(await evaluate("document.querySelector('#vice-label-field').hidden"),false);
   assert.equal(await evaluate("document.querySelector('[name=viceChairLabel]').required"),true);
   await evaluate("const original=window.fetch;window.fetch=async(url,options)=>String(url).startsWith('/api/media')?new Response(JSON.stringify([{url:'/api/image/qa/photo.jpg',filename:'<b>Logo QA</b>'}]),{headers:{'Content-Type':'application/json'}}):original(url,options);document.querySelector('.mp-open').click()");
   await waitFor(()=>evaluate("document.querySelectorAll('.mp-thumb').length===1"),'logo media');
   assert.equal(await evaluate("document.querySelector('.mp-thumb img').alt"),'<b>Logo QA</b>');assert.equal(await evaluate("document.querySelector('.mp-thumb b')"),null);
   await evaluate("document.querySelector('.mp-thumb').click()");
   assert.equal(await evaluate("document.querySelector('[name=logoUrl]').value"),'/api/image/qa/photo.jpg');
   await evaluate("document.querySelector('#type-form [type=submit]').click()");
   await waitFor(()=>evaluate("document.querySelector('#type-form-message').textContent.includes('Kode jenis sudah')"),'duplicate feedback');
   assert.deepEqual(typeMutations.at(-1).body,{name:'Jenis baru',candidateMode:'OPTIONAL_VICE',chairLabel:'Ketua',viceChairLabel:'Wakil Ketua',logoUrl:'/api/image/qa/photo.jpg',sortOrder:1,active:true,code:'NEW_TYPE'});
   assert.ok(typeMutations.at(-1).csrf);
   await evaluate("document.querySelector('#type-cancel').click();document.querySelector('[data-type-edit]').click()");
   assert.equal(await evaluate("document.querySelector('[name=code]').readOnly"),true);
   await evaluate("document.querySelector('[name=name]').value='Nama baru';document.querySelector('#type-form [type=submit]').click()");
   await waitFor(()=>evaluate("document.querySelector('#type-form-message').textContent.includes('Data sudah berubah')"),'stale master');
   assert.equal(typeMutations.at(-1).body.expectedRevision,2);assert.equal('code' in typeMutations.at(-1).body,false);
   await evaluate("document.querySelector('#type-cancel').click();document.querySelector('[data-type-delete]').click()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'delete confirmation');
   const before=typeMutations.length;await evaluate("document.querySelector('#action-confirm-dialog button[value=cancel]').click()");await delay(50);assert.equal(typeMutations.length,before);
   await evaluate("document.querySelector('[data-type-delete]').click()");await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'delete again');
   await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>evaluate("document.querySelector('#type-message').textContent.includes('sudah dipakai periode')"),'used type delete');
   typeMutationMode='success';await evaluate("document.querySelector('[data-type-toggle]').click()");await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'toggle confirmation');
   await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>typeMutations.at(-1)?.method==='PATCH'&&typeMutations.at(-1)?.body.active===false,'toggle request');
   await waitFor(()=>evaluate("!document.querySelector('#action-confirm-dialog').open&&!document.querySelector('[data-type-toggle]').disabled"),'toggle reload');
   assert.deepEqual(typeMutations.at(-1).body,{expectedRevision:2,active:false});typeMutationMode='conflict';
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
   await evaluate("document.querySelector('#add-election-type').click()");assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
   await writeFile(resolve(artifactRoot,'type-dialog-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await navigate(origin+'/admin/e-voting/jenis-viewer');await waitFor(()=>evaluate("document.querySelector('h1')?.textContent==='Jenis Pemilihan'"),'viewer types');
   assert.equal(await evaluate("!!document.querySelector('#add-election-type')||!!document.querySelector('#type-form')||!!document.querySelector('[data-type-edit]')"),false);
 });
 await check('draft type picker preserves snapshots, reorders selected rights and handles populated/stale/locked states',async()=>{
   const path='/admin/e-voting/10000000-0000-4000-8000-000000000001';
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
   await navigate(origin+path);
   await waitFor(()=>evaluate("document.querySelector('#period-edit-types')?.dataset.ready==='true'"),'draft types');
   assert.equal(await evaluate("document.querySelectorAll('#period-edit-type-options input:checked').length"),5);
   await evaluate("document.querySelector('#period-edit-type-options button[data-code=IPPNU][data-move=\"-1\"]').click()");
   assert.deepEqual(await evaluate("[...document.querySelectorAll('#period-edit-type-options input:checked')].map(i=>i.value)"),['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPPNU','IPNU']);
   await evaluate("const i=document.querySelector('#period-edit-type-options input[value=IPNU]');i.checked=false;i.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#period-contests-form [type=submit]').click()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'membership confirmation');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>evaluate("document.querySelector('#period-contests-message').textContent.includes('masih berisi calon')"),'populated contest');
   assert.deepEqual(contestMutations.at(-1).body,{organizations:['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPPNU'],expectedRevision:3});assert.ok(contestMutations.at(-1).csrf);
   contestMutationMode='stale';await evaluate("document.querySelector('#period-contests-form [type=submit]').click()");await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'stale confirmation');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>evaluate("document.querySelector('#period-contests-message').textContent.includes('Susunan sudah berubah')"),'stale contests');
   assert.equal(await evaluate("document.querySelector('#period-contests-form [type=submit]').disabled"),true);
   await navigate(origin+'/admin/e-voting/10000000-0000-4000-8000-000000000002');await waitFor(()=>evaluate("!!document.querySelector('#period-locked-types')"),'locked contests');
   assert.equal(await evaluate("!!document.querySelector('#period-contests-form')||!!document.querySelector('[data-contest-picker]')"),false);
   assert.equal(await evaluate("document.querySelectorAll('#period-locked-types li').length"),5);contestMutationMode='candidates';
 });
 await check('type picker enforces 1–20 choices, saves order and keeps inactive/renamed snapshots',async()=>{
   await navigate(origin+'/admin/e-voting');await waitFor(()=>evaluate("document.querySelector('#period-types')?.dataset.ready==='true'"),'picker bounds');
   await evaluate("document.querySelector('#period-form').closest('details').open=true;while(document.querySelector('#period-type-options input:checked'))document.querySelector('#period-type-options input:checked').click()");
   assert.equal(await evaluate("document.querySelector('#period-form [type=submit]').disabled"),true);
   await evaluate("for(let i=0;i<21;i++)document.querySelector('#period-type-options input:not(:checked)').click()");
   assert.equal(await evaluate("document.querySelector('#period-form [type=submit]').disabled"),true);
   await evaluate("document.querySelector('#period-type-options input:checked').click()");
   assert.equal(await evaluate("document.querySelectorAll('#period-type-options input:checked').length"),20);
   assert.equal(await evaluate("document.querySelector('#period-form [type=submit]').disabled"),false);
   typeFixtureMode='retained';
   const path='/admin/e-voting/10000000-0000-4000-8000-000000000001';
   await navigate(origin+path);await waitFor(()=>evaluate("document.querySelector('#period-edit-types')?.dataset.ready==='true'"),'retained picker');
   assert.equal(await evaluate("document.querySelector('#period-edit-type-options input[value=OSIS]').checked"),true);
   assert.equal(await evaluate("document.querySelector('#period-edit-type-options input[value=PRADANA_PUTRA]').closest('label').lastElementChild.textContent"),'PRADANA PUTRA');
   assert.equal(await evaluate("document.querySelector('#period-edit-type-options input[value=OSIS]').closest('label').lastElementChild.textContent"),'OSIS');
   contestMutationMode='success';const before=contestMutations.length;
   await evaluate("document.querySelector('#period-edit-type-options button[data-code=IPPNU][data-move=\"-1\"]').click();document.querySelector('#period-contests-form [type=submit]').click()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'save order confirm');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>contestMutations.length===before+1,'saved order request');
   assert.deepEqual(contestMutations.at(-1).body.organizations,['OSIS','PRADANA_PUTRA','PRADANA_PUTRI','IPPNU','IPNU']);
   await waitFor(()=>evaluate("document.querySelector('#period-edit-types')?.dataset.ready==='true'&&!document.querySelector('#period-contests-form [type=submit]').disabled"),'saved order reload');
   typeFixtureMode='normal';contestMutationMode='candidates';
 });
 await check('candidate form uses snapshot modes, master selection, nullable photos and stale guarded edit/delete',async()=>{
   const path='/admin/e-voting/10000000-0000-4000-8000-000000000001/calon';
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
   await navigate(origin+path);
   await waitFor(()=>evaluate("document.querySelector('[data-position=chair] legend')?.textContent==='Ketua OSIS snapshot'"),'candidate form snapshot');
   assert.equal(await evaluate("document.querySelector('[data-position=viceChair]').hidden"),true);
   await evaluate("document.querySelector('.edit-candidate').click()");
   assert.equal(await evaluate("document.querySelector('[data-position=viceChair]').disabled"),false);
   assert.equal(await evaluate("document.querySelector('#chair-search').value"),'Nama snapshot 0');
   assert.equal(await evaluate("document.querySelector('[name=chairPhotoUrl]').value"),'/api/image/qa/portrait.png');
   await evaluate("document.querySelector('[name=vision]').value='Visi edit';document.querySelector('#save-candidate').click()");
   await waitFor(()=>candidateMutations.length>0,'candidate edit request');
   await waitFor(()=>evaluate("document.querySelector('#candidate-message').textContent.includes('Data calon berubah')"),'stale candidate edit');
   assert.equal(candidateMutations.at(-1).method,'PATCH');assert.equal(candidateMutations.at(-1).body.chair.photoUrl,'/api/image/qa/portrait.png');
   assert.deepEqual(candidateMutations.at(-1).body.expected,{ballotNumber:1,chairStudentId:'20000000-0000-4000-8000-000000000001',viceChairStudentId:'20000000-0000-4000-8000-000000000002',chairPhotoUrl:'/api/image/qa/portrait.png',viceChairPhotoUrl:null,vision:'Visi sintetis',mission:'Misi sintetis'});assert.ok(candidateMutations.at(-1).csrf);
   await evaluate("document.querySelector('#use-vice-chair').click();document.querySelector('#save-candidate').click()");
   await waitFor(()=>candidateMutations.at(-1)?.body.viceChair===null,'remove optional vice');
   assert.equal(await evaluate("document.querySelector('#vice-search').value"),'');assert.equal(await evaluate("document.querySelector('[name=viceChairPhotoUrl]').value"),'');
   await evaluate("document.querySelector('#use-vice-chair').click();const i=document.querySelector('#vice-search');i.value='Siswa';i.dispatchEvent(new Event('input'));document.querySelector('#use-vice-chair').click()");
   await delay(350);assert.equal(await evaluate("document.querySelector('#vice-student-results').textContent"),'');
   await evaluate("document.querySelector('#cancel-edit').click();const s=document.querySelector('[name=organization]');s.value='PRADANA_PUTRA';s.dispatchEvent(new Event('change'))");
   assert.equal(await evaluate("getComputedStyle(document.querySelector('.vice-option')).display"),'none');
   assert.equal(await evaluate("document.querySelector('[data-position=viceChair]').disabled"),true);
   assert.equal(await evaluate("document.querySelector('[data-position=chair] legend').textContent"),'Pradana snapshot');
   await evaluate("const f=document.querySelector('#candidate-form');f.elements.ballotNumber.value='2';f.elements.vision.value='Visi';f.elements.mission.value='Misi';const i=document.querySelector('#chair-search');i.value='Siswa';i.dispatchEvent(new Event('input'))");
   const before=candidateMutations.length;await evaluate("document.querySelector('#save-candidate').click()");
   assert.equal(candidateMutations.length,before);
   await waitFor(()=>evaluate("document.querySelectorAll('#chair-student-results button').length===2"),'student suggestions');
   assert.match(await evaluate("document.querySelector('#chair-student-results button').textContent"),/9900000000.*X QA/);
   await evaluate("document.querySelector('#chair-student-results button').click()");
   assert.equal(await evaluate("document.querySelector('[data-position=chair] .student-id').value"),'20000000-0000-4000-8000-000000000001');
   candidateMutationCode='DUPLICATE_CANDIDATE';await evaluate("document.querySelector('#save-candidate').click()");
   await waitFor(()=>evaluate("document.querySelector('#candidate-message').textContent.includes('sudah digunakan')"),'duplicate candidate feedback');
   assert.equal(candidateMutations.at(-1).method,'POST');assert.equal(candidateMutations.at(-1).body.organization,'PRADANA_PUTRA');assert.equal(candidateMutations.at(-1).body.viceChair,null);
   candidateMutationCode='STALE_CANDIDATE';await evaluate("document.querySelector('.delete-candidate').click()");await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'candidate delete popup');
   const count=candidateMutations.length;await evaluate("document.querySelector('#action-confirm-dialog button[value=cancel]').click()");await delay(60);assert.equal(candidateMutations.length,count);
   await evaluate("document.querySelector('.delete-candidate').click()");await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'candidate delete again');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>evaluate("document.querySelector('#candidate-message').textContent.includes('Muat ulang sebelum menghapus')"),'stale candidate delete');
   assert.equal(candidateMutations.at(-1).method,'DELETE');assert.deepEqual(Object.keys(candidateMutations.at(-1).body),['expected']);assert.equal(candidateMutations.at(-1).body.expected.chairPhotoUrl,'/api/image/qa/portrait.png');
   for(const n of [2,3]){
     await navigate(origin+path.replace('001/calon','00'+n+'/calon'));await waitFor(()=>evaluate("!!document.querySelector('#current-candidates-title')"),'locked/viewer candidates');
     assert.equal(await evaluate("!!document.querySelector('#candidate-form')||!!document.querySelector('.edit-candidate')||!!document.querySelector('.delete-candidate')"),false);
   }
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
   await navigate(origin+path.replace('001/calon','004/calon'));await waitFor(()=>evaluate("document.querySelector('.media-picker')?.dataset.wired==='true'&&document.querySelector('[data-position=chair] legend')?.textContent==='Ketua OSIS snapshot'"),'candidate media');
   await evaluate("document.querySelector('.edit-candidate').click()");
   assert.equal(await evaluate("document.querySelector('.mp-preview-img').getAttribute('src')"),'/api/image/qa/portrait.png');
   assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
   await writeFile(resolve(artifactRoot,'candidate-form-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 });
 await check('portrait ballots keep equal photo/fallback geometry and keyboard confirmation for students and teachers',async()=>{
   for(const [kind,width] of [['student',1366],['student',390],['teacher',320]]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
     await navigate(origin+'/portraits/'+kind+'/OSIS');await waitFor(()=>evaluate("document.querySelector('#review-vote')?.disabled===false&&document.querySelector('.member img')?.complete"),'portrait ballot');
     assert.equal(await evaluate("document.body.dataset.portalBase"),kind==='teacher'?'/pemilih':'/siswa');
     const geometry=await evaluate("(()=>{const a=document.querySelector('.members.paired img'),b=document.querySelector('.members.paired .photo-fallback');return {a:a.getBoundingClientRect().height,b:b.getBoundingClientRect().height,aw:a.getBoundingClientRect().width,bw:b.getBoundingClientRect().width,natural:a.naturalWidth,url:a.currentSrc,loading:a.loading,priority:a.fetchPriority}})()");
     assert.ok(geometry.a>=260&&geometry.a<=320);assert.equal(geometry.a,geometry.b);assert.ok(Math.abs(geometry.aw-geometry.bw)<=1);assert.ok(geometry.natural>0);assert.match(geometry.url,/\?w=\d+/);assert.equal(geometry.loading,'eager');assert.equal(geometry.priority,'high');
     assert.equal(await evaluate("document.querySelectorAll('.members')[1].querySelector('img').loading"),'lazy');
     assert.equal(await evaluate("document.querySelectorAll('.members')[1].children.length"),1);assert.equal(await evaluate("document.querySelectorAll('.members')[2].querySelectorAll('img').length"),0);
     assert.equal(await evaluate("document.querySelector('.member strong b')"),null);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
     await evaluate("document.querySelector('.candidate').scrollIntoView()");await writeFile(resolve(artifactRoot,'portraits-'+kind+'-'+width+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
     await evaluate("document.querySelector('input[name=candidateId]').focus()");
     await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
     await evaluate("document.querySelector('#review-vote').click()");assert.equal(await evaluate("document.querySelector('#confirm-dialog').open"),true);assert.match(await evaluate("document.querySelector('#confirm-candidate').textContent"),/Calon utama <b>aman<\/b> dan Wakil/);
     assert.equal(await evaluate("document.querySelector('#confirm-candidate b')"),null);await evaluate("document.querySelector('#confirm-dialog .secondary').click()");
     assert.equal(await evaluate("document.querySelector('#confirm-dialog').open"),false);assert.equal(await evaluate("document.querySelectorAll('input[name=candidateId]:checked').length"),1);
   }
 });
 await check('early close accepts incomplete turnout, requires a reason, confirms remaining rights and clears passwords',async()=>{
   const path='/admin/e-voting/10000000-0000-4000-8000-000000000005';
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
   await navigate(origin+path);await waitFor(()=>evaluate("document.querySelector('#close-period-form button')?.disabled===false"),'early closure readiness');
   assert.deepEqual(await evaluate("[...document.querySelectorAll('.closing-summary dd')].map(e=>e.textContent)"),['1','1','1']);
   assert.equal(await evaluate("document.querySelector('#close-period-form [name=reason]').required"),true);
   await evaluate("const f=document.querySelector('#close-period-form');f.elements.reason.value=' '.repeat(20);f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#close-period-message').textContent.includes('10–500')"),'whitespace reason');
   assert.equal(closeRequests.length,0);assert.equal(await evaluate("document.querySelector('#close-period-form [name=adminPassword]').value"),'');
   await evaluate("const f=document.querySelector('#close-period-form');f.elements.reason.value='  Pemilih absen sesuai berita acara  ';f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'close confirmation');
   assert.match(await evaluate("document.querySelector('#action-confirm-dialog-description').textContent"),/1 lengkap, 1 parsial, 1 belum mulai/);
   assert.match(await evaluate("document.querySelector('#action-confirm-dialog-description').textContent"),/hak pilih tersisa berakhir.*hasil belum dipublikasikan/);
   await evaluate("document.querySelector('#action-confirm-dialog button[value=cancel]').click()");
   await waitFor(()=>evaluate("!document.querySelector('#close-period-form button').disabled"),'cancel close');assert.equal(closeRequests.length,0);
   assert.equal(await evaluate("document.querySelector('#close-period-form [name=adminPassword]').value"),'');
   for(const [code,text]of [['INVALID_REAUTH','tidak valid'],['RATE_LIMITED','Terlalu banyak'],['RECONCILIATION_FAILED','Rekonsiliasi tidak cocok'],['TEMPORARILY_UNAVAILABLE','belum dapat dipastikan']]){
     closeError=code;
     await evaluate("const f=document.querySelector('#close-period-form');f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
     await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'close retry popup');
     await evaluate("document.querySelector('#close-period-form').dispatchEvent(new Event('submit',{cancelable:true}));document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
     await waitFor(()=>evaluate("!document.querySelector('#close-period-message').hidden&&!document.querySelector('#close-period-form button').disabled"),'close error feedback');
     assert.ok((await evaluate("document.querySelector('#close-period-message').textContent")).includes(text));
     assert.equal(await evaluate("document.querySelector('#close-period-form [name=adminPassword]').value"),'');
     assert.deepEqual(closeRequests.at(-1).body,{adminPassword:'synthetic-password',early:true,reason:'Pemilih absen sesuai berita acara'});assert.ok(closeRequests.at(-1).csrf);
   }
   assert.equal(closeRequests.length,4);
   await evaluate("document.querySelector('#close-period-form').closest('section').scrollIntoView()");assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
   await writeFile(resolve(artifactRoot,'close-period-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   closeError='success';await evaluate("const f=document.querySelector('#close-period-form');f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'success close popup');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>closeRequests.length===5,'close success request');await waitFor(()=>evaluate("!document.querySelector('#action-confirm-dialog').open&&!document.querySelector('#close-period-form button').disabled"),'close reload');
 });
 await check('normal close omits the early reason and future/unpermitted/unavailable periods cannot submit',async()=>{
   const path='/admin/e-voting/10000000-0000-4000-8000-00000000000';
   await navigate(origin+path+'7');await waitFor(()=>evaluate("document.querySelector('#close-period-form button')?.disabled===false"),'deadline close');
   assert.equal(await evaluate("document.querySelector('#close-period-form').dataset.early"),'false');assert.equal(await evaluate("!!document.querySelector('#close-period-form [name=reason]')"),false);
   closeError='RECONCILIATION_FAILED';await evaluate("const f=document.querySelector('#close-period-form');f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'deadline popup');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>evaluate("document.querySelector('#close-period-message').textContent.includes('Rekonsiliasi')"),'deadline feedback');assert.deepEqual(closeRequests.at(-1).body,{adminPassword:'synthetic-password',early:false});
   for(const n of [6,8]){
     await navigate(origin+path+n);await waitFor(()=>evaluate("!!document.querySelector('#period-config-form')"),'closed action unavailable');assert.equal(await evaluate("!!document.querySelector('#close-period-form')"),false);
   }
   await navigate(origin+path+'9');await waitFor(()=>evaluate("!!document.querySelector('#close-period-form')"),'missing participation summary');
   assert.equal(await evaluate("document.querySelector('#close-period-form').dataset.ready"),'false');assert.equal(await evaluate("document.querySelector('#close-period-form button').disabled"),true);
   assert.equal(await evaluate("document.querySelector('#close-period-form [name=adminPassword]').disabled"),true);
 });
 await check('dashboard results links require publication and a closed/archived state; publication actions require permission',async()=>{
   for(const path of ['/admin/e-voting','/admin/e-voting/index-viewer']){
     await navigate(origin+path);
     const links=await evaluate("[...document.querySelectorAll('.results-access a[target=_blank]')].map(a=>({path:new URL(a.href).pathname,target:a.target,rel:a.rel,label:a.getAttribute('aria-label'),primary:a.classList.contains('btn-primary')}))");
     assert.deepEqual(links.map(a=>a.path),['/e-voting/qa-results-5/hasil','/e-voting/qa-results-archived/hasil']);
     for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.match(link.label,/Lihat hasil voting.*tab baru/);assert.equal(link.primary,true);}
     assert.equal(await evaluate("document.querySelectorAll('.results-access a[href$=\"#publish-results\"]').length"),path.endsWith('index-viewer')?0:2);
   }
   for(const [n,published,publishForm]of [[1,false,false],[2,false,false],[10,true,false],[11,true,false],[12,false,true],[13,false,false],[14,false,false],[15,false,false]]){
     await navigate(origin+'/admin/e-voting/10000000-0000-4000-8000-'+String(n).padStart(12,'0'));
     assert.equal(await evaluate("document.querySelector('.results-access').dataset.resultsPublished"),String(published));
     assert.equal(await evaluate("!!document.querySelector('#publish-period-form')"),publishForm);
     assert.equal(await evaluate("document.querySelectorAll('a[href^=\"/e-voting/\"]').length"),published?2:0);
     assert.match(await evaluate("document.querySelector('.results-access p').textContent"),published?/sudah dipublikasikan/:/belum tersedia|belum dipublikasikan/);
     for(const link of await evaluate("[...document.querySelectorAll('a[href^=\"/e-voting/\"]')].map(a=>({target:a.target,rel:a.rel,text:a.textContent}))")){
       assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.match(link.text,/tab baru/);
     }
   }
 });
 await check('prominent results CTA fits desktop/mobile and opens a new tab without leaving the dashboard',async()=>{
   for(const [width,path]of [[1366,'/admin/e-voting'],[320,'/admin/e-voting'],[390,'/admin/e-voting/10000000-0000-4000-8000-000000000010']]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
     await navigate(origin+path);
     await evaluate("document.querySelector('.results-access a[target=_blank]').scrollIntoView({block:'center'})");
     assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
     assert.equal(await evaluate("(()=>{const r=document.querySelector('.results-access a[target=_blank]').getBoundingClientRect();return r.width>150&&r.height>=40&&r.left>=0&&r.right<=innerWidth})()"),true);
     await writeFile(resolve(artifactRoot,'results-cta-'+width+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   }
   const before=new Set((await cdp('Target.getTargets')).targetInfos.map(t=>t.targetId));
   await evaluate("document.querySelector('.results-access a[target=_blank]').focus()");
   await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   await cdp('Input.dispatchKeyEvent',{type:'char',text:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   let opened;
   await waitFor(async()=>{opened=(await cdp('Target.getTargets')).targetInfos.find(t=>!before.has(t.targetId)&&t.type==='page'&&t.url===origin+'/e-voting/qa-results-5/hasil');return !!opened},'new results tab');
   assert.equal(await evaluate('location.pathname'),'/admin/e-voting/10000000-0000-4000-8000-000000000010');
   await cdp('Target.closeTarget',{targetId:opened.targetId});
 });
 await check('publication confirms explicitly, guards duplicate submit, reports errors and clears passwords; unavailable CSRF disables it',async()=>{
   const path='/admin/e-voting/10000000-0000-4000-8000-000000000012';
   await navigate(origin+path);await waitFor(()=>evaluate("document.querySelector('#publish-period-form button')?.disabled===false"),'publish readiness');
   await evaluate("const f=document.querySelector('#publish-period-form');f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'publish confirmation');
   assert.match(await evaluate("document.querySelector('#action-confirm-dialog-description').textContent"),/tidak dapat ditarik kembali/);
   await evaluate("document.querySelector('#action-confirm-dialog button[value=cancel]').click()");
   await waitFor(()=>evaluate("!document.querySelector('#publish-period-form button').disabled"),'publish cancel');
   assert.equal(publishRequests.length,0);assert.equal(await evaluate("document.querySelector('#publish-period-form [name=adminPassword]').value"),'');
   for(const [code,text]of [['INVALID_REAUTH','tidak valid'],['RATE_LIMITED','Terlalu banyak'],['INVALID_STATE','Status periode'],['FORBIDDEN','izin publikasi'],['CSRF_REJECTED','Sesi keamanan'],['TEMPORARILY_UNAVAILABLE','belum dapat dipublikasikan']]){
     publishError=code;
     await evaluate("const f=document.querySelector('#publish-period-form');f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
     await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'publish retry');
     await evaluate("document.querySelector('#publish-period-form').dispatchEvent(new Event('submit',{cancelable:true}));document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
     await waitFor(()=>evaluate("!document.querySelector('#publish-period-message').hidden&&!document.querySelector('#publish-period-form button').disabled"),'publish feedback');
     assert.ok((await evaluate("document.querySelector('#publish-period-message').textContent")).includes(text));
     assert.equal(await evaluate("document.querySelector('#publish-period-form [name=adminPassword]').value"),'');
     assert.deepEqual(publishRequests.at(-1),{body:{adminPassword:'synthetic-password'},csrf:'synthetic-period-csrf'});
   }
   assert.equal(publishRequests.length,6);
   await evaluate("document.querySelector('#publish-results').scrollIntoView()");assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
   await writeFile(resolve(artifactRoot,'results-publication-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   publishError='success';await evaluate("const f=document.querySelector('#publish-period-form');f.elements.adminPassword.value='synthetic-password';f.requestSubmit()");
   await waitFor(()=>evaluate("document.querySelector('#action-confirm-dialog').open"),'publish success confirm');await evaluate("document.querySelector('#action-confirm-dialog button[value=confirm]').click()");
   await waitFor(()=>publishRequests.length===7,'publish success request');await waitFor(()=>evaluate("!document.querySelector('#action-confirm-dialog').open&&!document.querySelector('#publish-period-form button').disabled&&document.querySelector('#publish-period-form [name=adminPassword]').value===''") ,'publish reload');
   periodCsrfReady=false;
   try{
     await navigate(origin+path);await waitFor(()=>evaluate("!document.querySelector('#publish-period-message').hidden"),'publish missing csrf');
     assert.equal(await evaluate("document.querySelector('#publish-period-form button').disabled"),true);
     await evaluate("document.querySelector('#publish-period-form').dispatchEvent(new Event('submit',{cancelable:true}))");assert.equal(publishRequests.length,7);
   }finally{periodCsrfReady=true;}
 });
 await check('photo/logo pickers and document uploads send explicit policies, show indexing warnings, and retain usable URLs',async()=>{
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
   await navigate(origin+'/uploads');
   await waitFor(()=>evaluate("document.querySelectorAll('.media-picker[data-wired=true]').length===2"),'upload controls');
   for(const [field,kind]of [['qaPhoto','photo'],['qaLogo','logo']]){
     uploadMode=field==='qaLogo'?'noindex':'normal';
     await evaluate(`document.querySelector('[name=${field}]').closest('.media-picker').querySelector('.mp-open').click();document.querySelector('[name=${field}]').closest('.media-picker').querySelector('[data-tab=upload]').click()`);
     await evaluate(`(async()=>{const bytes=await(await fetch('/api/image/qa/photo.jpg')).arrayBuffer();const d=new DataTransfer();d.items.add(new File([bytes],'upload.jpg',{type:'image/jpeg'}));const input=document.querySelector('[name=${field}]').closest('.media-picker').querySelector('.mp-file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
     await waitFor(()=>evaluate(`document.querySelector('[name=${field}]').value.includes('/api/image/qa/upload-')`),'picker upload');
     assert.deepEqual(uploadRequests.at(-1),{name:'upload.jpg',folder:'e-voting',assetKind:kind});
     if(field==='qaLogo'){
       assert.match(await evaluate("document.querySelector('[name=qaLogo]').closest('.media-picker').querySelector('.mp-upload-status').textContent"),/belum tercatat/);
       assert.equal(await evaluate("document.querySelector('[name=qaLogo]').closest('.media-picker').querySelector('.mp-modal').style.display"),'flex');
       await evaluate("document.querySelector('[name=qaLogo]').closest('.media-picker').querySelector('.mp-close').click()");
     }
   }
   uploadMode='normal';await evaluate("const d=new DataTransfer();d.items.add(new File(['%PDF-1.7\\nQA\\n%%EOF'],'document.pdf',{type:'application/pdf'}));const input=document.querySelector('.fu-file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}))");
   await waitFor(()=>evaluate("document.querySelector('[name=qaDocument]').value.includes('/api/image/qa/upload-')"),'document upload');
   assert.deepEqual(uploadRequests.at(-1),{name:'document.pdf',folder:'downloads',assetKind:'document'});
   assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
   await writeFile(resolve(artifactRoot,'upload-controls-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 });
 await check('library upload offers lossless logos, exposes errors and reports indexing failure safely',async()=>{
   uploadMode='error';await evaluate("document.querySelector('#upload-asset-kind').value='logo'");
   const send="(async()=>{const bytes=await(await fetch('/api/image/qa/photo.jpg')).arrayBuffer();const d=new DataTransfer();d.items.add(new File([bytes],'logo.jpg',{type:'image/jpeg'}));const input=document.querySelector('#upload-input');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()";
   await evaluate("window.alert=message=>window.qaUploadAlert=message");await evaluate(send);
   await waitFor(()=>evaluate("window.qaUploadAlert?.includes('Upload belum berhasil')"),'upload failure feedback');
   uploadMode='noindex';await evaluate(send);await waitFor(()=>evaluate("document.querySelector('#upload-result').textContent.includes('belum tercatat')"),'library index warning');
   assert.equal(uploadRequests.at(-1).assetKind,'logo');assert.equal(uploadRequests.at(-1).folder,'uploads');
   assert.equal(await evaluate("document.querySelector('#upload-result').style.display"),'block');uploadMode='normal';
 });
 await check('published results show correct people/ballot totals, historical portraits, ordered choices and per-type percentages for 1/5/6 types',async()=>{
   for(const [n,width]of [[1,390],[5,1366],[6,320]]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
     await navigate(origin+'/e-voting/qa-results-'+n+'/hasil');await waitFor(()=>evaluate("!!document.querySelector('.overview')&&!document.querySelector('#print-results').hidden"),'results '+n);
     assert.equal(await evaluate("document.querySelectorAll('section.contest').length"),n);assert.equal(await evaluate("document.querySelectorAll('.contest-nav a').length"),n);
     const stats=await evaluate("Object.fromEntries([...document.querySelectorAll('[data-stat]')].map(e=>[e.dataset.stat,parseInt(e.firstChild.textContent)]))");
     assert.deepEqual(stats,{eligible:10,participating:7,ballots:n===1?7:n===5?26:30,contests:n});
     assert.equal(await evaluate("document.querySelector('.donut-value').textContent"),'7');
     assert.match(await evaluate("document.querySelector('.donut title').textContent"),n===1?/7 lengkap, 0 parsial, 3 belum mulai/:/4 lengkap, 3 parsial, 3 belum mulai/);
     assert.ok(Math.abs((await evaluate("[...document.querySelectorAll('.donut circle')].reduce((sum,e)=>sum+parseFloat(e.getAttribute('stroke-dasharray')),0)"))-100)<.00001);
     const expectedNumbers=Array.from({length:n},()=>['01','02','03']);
     assert.deepEqual(await evaluate("[...document.querySelectorAll('section.contest')].map(e=>[...e.querySelectorAll('.candidate-heading h3 span')].map(e=>e.textContent))"),expectedNumbers);
     assert.equal(await evaluate("document.querySelector('.contest-total span').textContent"),'70,0% dari 10 pemilih');
     assert.equal(await evaluate("document.querySelector('.percentage').textContent"),'57,1%');assert.equal(await evaluate("document.querySelector('.vote-track span').style.width"),'57.1429%');
     assert.equal(await evaluate("document.querySelector('.member strong').textContent"),'Calon 1 <b>historis</b>');assert.equal(await evaluate("document.querySelector('.member strong b')"),null);
     assert.equal(await evaluate("document.querySelector('.position').textContent"),n===1?'Pradana historis':'Ketua historis');
     assert.equal(await evaluate(`document.querySelectorAll('.candidate .member')[${n===1?2:3}].querySelector('.photo-fallback')!==null`),true);
     assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
     assert.doesNotMatch(await evaluate("document.documentElement.outerHTML"),/studentId|teacherId|voterId|nisn|pinHash|voterType|GURU-|Siswa Pilihan/);
     assert.equal(await evaluate("document.querySelector('.candidate .member img').loading"),'eager');assert.equal(await evaluate("document.querySelector('.candidate .member img').fetchPriority"),'high');
     assert.equal(await evaluate("document.querySelectorAll('.candidate')[1].querySelector('.member img').loading"),'lazy');
     await writeFile(resolve(artifactRoot,'results-overview-'+width+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
     await evaluate("document.querySelector('section.contest').scrollIntoView()");await waitFor(()=>evaluate("document.querySelector('.candidate .member img').naturalWidth>0"),'result image');
     const geometry=await evaluate("[...document.querySelector('.candidates').querySelectorAll('.member img,.photo-fallback')].map(e=>e.getBoundingClientRect().height)");assert.ok(geometry.every(h=>h>=260&&h<=320));
     await writeFile(resolve(artifactRoot,'results-candidates-'+width+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
     await evaluate("document.querySelector('.statements summary').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
     assert.equal(await evaluate("document.querySelector('.statements').open"),true);assert.match(await evaluate("document.querySelector('.statements-content').textContent"),/Visi historis 1 <b>aman<\/b>/);assert.equal(await evaluate("document.querySelector('.statements-content b')"),null);
     await evaluate("[...document.querySelectorAll('.contest-nav a')].at(-1).click()");assert.equal(await evaluate("decodeURIComponent(location.hash)"),'#hasil-'+(n===1?'PRADANA_PUTRI':n===5?'IPPNU':'NEW_TYPE'));
   }
 });
 await check('zero votes and ties receive accurate labels and unpublished/invalid snapshots never render candidates',async()=>{
   for(const kind of ['zero','tie','archived','draft','scheduled','unpublished','corrupt','error']){
     await navigate(origin+'/e-voting/qa-results-'+kind+'/hasil');await waitFor(()=>evaluate("!!document.querySelector('h1')"),'result gate '+kind);
     if(['zero','tie','archived'].includes(kind)){
       assert.equal(await evaluate("document.querySelectorAll('section.contest').length"),5);
       assert.doesNotMatch(await evaluate("document.body.innerText"),/NaN|Infinity|pemenang/i);
       if(kind==='zero'){
         assert.equal(await evaluate("parseInt(document.querySelector('[data-stat=participating]').textContent)"),0);assert.equal(await evaluate("parseInt(document.querySelector('[data-stat=ballots]').textContent)"),0);
         assert.equal(await evaluate("document.querySelectorAll('.leader-tag').length"),0);assert.equal(await evaluate("[...document.querySelectorAll('.percentage')].every(e=>e.textContent==='0,0%')"),true);
         assert.equal(await evaluate("[...document.querySelectorAll('.vote-track span')].every(e=>e.style.width==='0%')"),true);
       }
       if(kind==='tie'){
         assert.equal(await evaluate("document.querySelectorAll('.leader-tag').length"),10);assert.equal(await evaluate("[...document.querySelectorAll('.leader-tag')].every(e=>e.textContent==='Seri · Perolehan tertinggi')"),true);
         assert.equal(await evaluate("document.querySelector('.percentage').textContent"),'50,0%');
       }
     }else{
       assert.equal(await evaluate("document.querySelectorAll('.candidate,.overview,.contest-nav').length"),0);
       assert.equal(await evaluate("document.querySelector('h1').textContent"),['corrupt','error'].includes(kind)?'Hasil sementara tidak tersedia':'Hasil belum tersedia');
       assert.doesNotMatch(await evaluate("document.body.innerText"),/Synthetic private|INVALID_RESULT|Calon 1|Prisma|database error/);
     }
   }
 });
 await check('result thumbnails reduce actual image bytes at DPR 1/2 and the complete report remains readable without scripts and in print',async()=>{
   const measurements=[],original=(await readFile(resolve(fixtureRoot,'assets/kepala-sekolah.png'))).length;
   for(const [width,dpr]of [[1366,1],[390,2]]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:dpr,mobile:false});
     await navigate(origin+'/e-voting/qa-results-5/hasil');await waitFor(()=>evaluate("document.querySelector('.candidate .member img')?.naturalWidth>0"),'responsive result photo');
     const info=await evaluate("(()=>{const i=document.querySelector('.candidate .member img');return {source:i.currentSrc,naturalWidth:i.naturalWidth,displayWidth:i.getBoundingClientRect().width}})()");
     const url=new URL(info.source);assert.ok(Number(url.searchParams.get('w'))>0&&Number(url.searchParams.get('w'))<=960);
     await waitFor(()=>imageRenders.some(row=>row.url===url.pathname+url.search),'image render measurement');
     const render=imageRenders.findLast(row=>row.url===url.pathname+url.search);assert.ok(render.bytes<original);
     measurements.push({width,dpr,requestedWidth:Number(url.searchParams.get('w')),originalBytes:original,thumbnailBytes:render.bytes,observedHandlerMs:render.ms,naturalWidth:info.naturalWidth,displayWidth:info.displayWidth});
   }
   await writeFile(resolve(artifactRoot,'results-media.json'),JSON.stringify(measurements,null,2));
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:1000,deviceScaleFactor:1,mobile:false});
   await cdp('Emulation.setScriptExecutionDisabled',{value:true});
   try{
     await navigate(origin+'/e-voting/qa-results-5/hasil');await waitFor(()=>evaluate("document.querySelectorAll('section.contest').length===5"),'no-script report');
     assert.equal(await evaluate("document.querySelector('#print-results').hidden"),true);
     await evaluate("document.querySelector('.statements summary').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});assert.equal(await evaluate("document.querySelector('.statements').open"),true);
     await cdp('Emulation.setEmulatedMedia',{media:'print'});
     assert.equal(await evaluate("getComputedStyle(document.querySelector('.contest-nav')).display"),'none');
     assert.equal(await evaluate("[...document.querySelectorAll('.statements-content')].every(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).contentVisibility!=='hidden')"),true);
     const pdf=await cdp('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});const buffer=Buffer.from(pdf.data,'base64');assert.equal(buffer.subarray(0,4).toString(),'%PDF');await writeFile(resolve(artifactRoot,'results-print.pdf'),buffer);
     await writeFile(resolve(artifactRoot,'results-print.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
   }finally{await cdp('Emulation.setEmulatedMedia',{media:''});await cdp('Emulation.setScriptExecutionDisabled',{value:false});}
 });
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({outcomes,errors},null,2));await writeFile(resolve(artifactRoot,'results.json'),JSON.stringify({outcomes,errors},null,2));
}catch(error){console.error(error);console.error(JSON.stringify({errors,state:socket?.readyState===1?await evaluate("({url:location.href,title:document.title,body:document.body?.innerText.slice(0,1600),scripts:[...document.scripts].map(s=>s.src)})").catch(()=>null):null},null,2));process.exitCode=1}
finally{socket?.close();browser.kill();server.closeAllConnections();server.close();await delay(400);if(profile.startsWith(artifactRoot+sep)&&profile.includes('browser-'))await rm(profile,{recursive:true,force:true}).catch(()=>{})}
