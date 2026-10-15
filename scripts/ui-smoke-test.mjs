import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const fixtureRoot=resolve('scripts/ui-fixture/dist');
const server=createServer(async(request,response)=>{try{const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);const logo=resolve('public/assets/logo.png');const file=path==='/assets/logo.png'?logo:resolve(fixtureRoot,'.'+(path==='/'?'/index.html':extname(path)?path:path+'/index.html'));if(file!==logo&&!file.startsWith(fixtureRoot+sep)){response.writeHead(403).end();return}const body=await readFile(file);response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)]??'application/octet-stream');response.end(body)}catch{response.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const artifactRoot=resolve('artifacts/ui-qa');
await mkdir(artifactRoot,{recursive:true});
const profile=await mkdtemp(resolve(artifactRoot,'browser-'));
const browser=spawn(process.env.UI_QA_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1366,768','about:blank'],{windowsHide:true,stdio:'ignore'});
browser.on('error',error=>{console.error(error.message)});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const outcomes=[],errors=[];let socket;let id=0;const pending=new Map();
async function waitFor(fn,label){for(let i=0;i<100;i++){try{if(await fn())return}catch{}await delay(100)}throw new Error('Timed out: '+label)}
async function cdp(method,params={}){const callId=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(callId);reject(new Error('CDP timeout '+method))},10000);pending.set(callId,{resolve:result=>{clearTimeout(timer);resolve(result)},reject});socket.send(JSON.stringify({id:callId,method,params}))})}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression:'(()=>eval('+JSON.stringify(expression)+'))()',returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value}
const check=(name,fn)=>fn().then(()=>outcomes.push({name,passed:true}));
try{
 let target;await waitFor(async()=>{const port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];const list=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=list.find(item=>item.type==='page');return !!target},'browser launch');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const call=pending.get(message.id);pending.delete(message.id);if(message.error)call?.reject(new Error(message.error.message));else call?.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)});
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
 // Exercise the local font fallback deterministically without waiting for external font services.
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
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({outcomes,errors},null,2));await writeFile(resolve(artifactRoot,'results.json'),JSON.stringify({outcomes,errors},null,2));
}catch(error){console.error(error);console.error(JSON.stringify({errors,state:socket?.readyState===1?await evaluate("({url:location.href,title:document.title,body:document.body?.innerText.slice(0,1600),scripts:[...document.scripts].map(s=>s.src)})").catch(()=>null):null},null,2));process.exitCode=1}
finally{socket?.close();browser.kill();server.closeAllConnections();server.close();await delay(400);if(profile.startsWith(artifactRoot+sep)&&profile.includes('browser-'))await rm(profile,{recursive:true,force:true}).catch(()=>{})}
