import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {imageResponse}=await tsImport('../src/lib/image-response.ts',import.meta.url);
const fixtureRoot=resolve('scripts/ui-fixture/dist');
const imageRenders=[];
const server=createServer(async(request,response)=>{try{
  const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(path.startsWith('/api/image/qa/')){
    const start=performance.now();
    const result=await imageResponse(new Request(origin+request.url),path.slice('/api/image/'.length),async()=>({bytes:await readFile(resolve(fixtureRoot,'assets/hero-siswa.png')),contentType:'image/png'}));
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
const check=(name,fn)=>fn().then(()=>outcomes.push({name,passed:true}));
try{
 let target;await waitFor(async()=>{const port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];const list=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=list.find(item=>item.type==='page');return !!target},'browser launch');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const call=pending.get(message.id);pending.delete(message.id);if(message.error)call?.reject(new Error(message.error.message));else call?.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);else if(message.method==='Network.requestWillBeSent'){const url=message.params.request.url;if(/fonts\.(?:googleapis|gstatic)\.com|\.woff2/.test(url))fontRequests.push(url);if(/youtube(?:-nocookie)?\.com\/embed|google\.com\/maps\/embed/.test(url))embedRequests.push(url)}});
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
 // Fonts must work locally even when Google Fonts cannot be reached.
 await cdp('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
 await cdp('Page.navigate',{url:origin+'/'});
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
 await cdp('Page.navigate',{url:origin+'/student'});
 await waitFor(()=>evaluate("document.body.dataset.periodId==='qa-period'"),'student fixture');
 await check('student session extension refreshes CSRF and logout clears private UI',async()=>{
   await evaluate("window.fetch=async(url)=>new Response(String(url).endsWith('/logout')?null:JSON.stringify({csrfToken:'qa-csrf-updated',idleExpiresAt:new Date(Date.now()+120000).toISOString()}),{status:String(url).endsWith('/logout')?204:200,headers:{'Content-Type':'application/json'}});document.querySelector('#extend-session').click()");
   await waitFor(()=>evaluate("document.body.dataset.csrf==='qa-csrf-updated'"),'CSRF refresh');
   assert.notEqual(await evaluate("document.querySelector('#session-expiry').textContent"),'Awal');
   await evaluate("document.querySelector('#logout-button').click()");await waitFor(()=>evaluate("location.pathname==='/siswa/masuk'"),'logout navigation');
   assert.equal(await evaluate("document.body.textContent.includes('Portal Siswa — fixture sintetis')"),false);
 });
 await check('expired student session removes private screen and returns to login',async()=>{
   await cdp('Page.navigate',{url:origin+'/student-expired'});await waitFor(()=>evaluate("location.pathname==='/siswa/masuk'&&location.search==='?expired=1'"),'expiry navigation');
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
   await cdp('Page.navigate',{url:origin+'/pemilih/masuk'});
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
   await cdp('Page.navigate',{url:origin+'/pemilih/selesai'});
   await waitFor(()=>evaluate("document.querySelector('h1')?.textContent==='Pemilihan Anda telah selesai'"),'teacher completion');
   assert.equal(await evaluate("document.querySelector('main a').getAttribute('href')"),'/pemilih/masuk');
   assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),true);
   await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:mock.identifier});
 });
 await check('expired draft shows roster actions; student choices survive paging and preview sends only selected IDs',async()=>{
   await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
   await cdp('Page.navigate',{url:origin+'/admin/e-voting/10000000-0000-4000-8000-000000000001/pemilih'});
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
   await cdp('Page.navigate',{url:origin+'/admin/e-voting/10000000-0000-4000-8000-000000000002/pemilih'});
   await waitFor(()=>evaluate("document.querySelector('.feedback[data-tone=info]')?.textContent.includes('terkunci')"),'opened roster notice');
   assert.equal(await evaluate("document.querySelector('#student-roster')===null&&document.querySelector('#teacher-roster')===null"),true);
 });
 await check('public images load responsive variants at desktop/mobile DPR 1/2; favicon and profile use optimized files',async()=>{
   await cdp('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*youtube.com*','*google.com/maps*']});
   await cdp('Network.setCacheDisabled',{cacheDisabled:true});
   const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.fetch=async()=>new Response('[]',{headers:{'Content-Type':'application/json'}})"});
   for(const width of [1366,390])for(const dpr of [1,2]){
     await cdp('Page.navigate',{url:'about:blank'});
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:dpr,mobile:false});
     await cdp('Page.navigate',{url:origin+'/public-home'});
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
   await cdp('Page.navigate',{url:origin+'/public-profile'});
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
   await cdp('Page.navigate',{url:origin+'/student'});
   await waitFor(()=>evaluate("location.pathname==='/student'&&document.body.classList.contains('student-portal')"),'student font scope');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate("performance.getEntriesByType('resource').some(r=>r.name.includes('material-symbols'))"),false,'Student portal needs no icon font');
   await cdp('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*youtube.com*','*google.com/maps*','*images.unsplash.com*']});
   await cdp('Page.navigate',{url:origin+'/public-facilities'});
   await waitFor(()=>evaluate("[...document.querySelectorAll('.material-symbols-outlined')].some(e=>e.textContent==='vacuum')"),'custom CMS icon');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate(`(()=>{const c=document.createElement('canvas').getContext('2d');c.font='500 24px "Material Symbols Outlined"';return c.measureText('vacuum').width})()`),24);
   assert.ok(await evaluate("performance.getEntriesByType('resource').some(r=>r.name.endsWith('/fonts/material-symbols-full-v1.woff2'))"));
   await cdp('Page.navigate',{url:origin+'/'});
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
     await cdp('Page.navigate',{url:'about:blank'});embedRequests.length=0;
     await cdp('Page.navigate',{url:origin+'/public-home'});
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
     await cdp('Page.navigate',{url:origin+'/public-home'});
     await waitFor(()=>evaluate("document.querySelectorAll('.embed-fallback').length===2"),'no-script links');
     assert.equal(await evaluate('document.querySelectorAll("iframe").length'),0);
     assert.equal(await evaluate("new URL(document.querySelector('[data-kind=map] .embed-fallback').href).searchParams.get('query')"),'SMK NU Darul Hikam Karanggeneng');
   }finally{await cdp('Emulation.setScriptExecutionDisabled',{value:false});}
 });
 await check('server announcement avoids a second fetch, pauses rotation on focus, persists dismissal and never moves the page',async()=>{
   await evaluate("localStorage.removeItem('smkdh_announce_dismissed')");
   const mock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.qaFetches=0;window.fetch=async()=>{window.qaFetches++;return new Response('[]')};const originalInterval=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===6000)window.qaRotate=fn;return originalInterval(fn,ms,...args)}"});
   await cdp('Page.navigate',{url:origin+'/public-home'});
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
   await cdp('Page.navigate',{url:origin+'/public-profile'});
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
     await cdp('Page.navigate',{url:origin+'/public-profile'});
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
       await cdp('Page.navigate',{url:origin+'/public-'+page});
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
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({outcomes,errors},null,2));await writeFile(resolve(artifactRoot,'results.json'),JSON.stringify({outcomes,errors},null,2));
}catch(error){console.error(error);console.error(JSON.stringify({errors,state:socket?.readyState===1?await evaluate("({url:location.href,title:document.title,body:document.body?.innerText.slice(0,1600),scripts:[...document.scripts].map(s=>s.src)})").catch(()=>null):null},null,2));process.exitCode=1}
finally{socket?.close();browser.kill();server.closeAllConnections();server.close();await delay(400);if(profile.startsWith(artifactRoot+sep)&&profile.includes('browser-'))await rm(profile,{recursive:true,force:true}).catch(()=>{})}
