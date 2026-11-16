// F03-004: real local Auth+Postgres+service-only save; deterministic model transport.
// Product quality MUST be separately evaluated with a configured live model.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';

const base=process.env.F03_WEB_URL||'http://127.0.0.1:5173/';
const bundle=await (await fetch(new URL('/src/supabaseClient.ts',base))).text();
if(!bundle.includes('http://127.0.0.1:54321'))
  throw new Error('Refusing First-Value browser run outside local Supabase.');
const localHealth=await (await fetch('http://127.0.0.1:3001/api/health')).json();
assert.equal(localHealth.localFirstValueSigningReady,true,
  'The local API must receive a server-only signing key before using paid AI generation.');
const chrome=process.env.CHROME_PATH||[
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome','/usr/bin/chromium',
].find(existsSync);
if(!chrome)throw new Error('Set CHROME_PATH to Chrome.');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1350,height:900}});
const page=await context.newPage();
const out=new URL('../docs/evidence/f03-004/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const inbox='http://127.0.0.1:54324';
async function signIn(email,fromGuest=true){
 const before=new Set((await (await fetch(inbox+'/api/v1/messages')).json()).messages.map(m=>m.ID));
 if(fromGuest)await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('#auth-email').fill(email);
 await page.getByRole('button',{name:/Send a sign-in code/}).click();
 let code=null;
 for(let i=0;i<35;i++){
  const list=(await (await fetch(inbox+'/api/v1/messages')).json()).messages;
  const mail=list.find(m=>!before.has(m.ID)&&m.To?.some(to=>to.Address===email));
  if(mail){
   const full=await (await fetch(inbox+'/api/v1/message/'+mail.ID)).json();
   code=(full.HTML||full.Text||'').match(/\b(\d{6})\b/)?.[1];
   if(code)break;
  }await sleep(300);
 }
 if(!code)throw new Error('Disposable local OTP did not arrive.');
 await page.locator('#auth-code').fill(code);
 await page.getByRole('button',{name:/Verify and continue/}).click();
}
try{
 const email='first-value-'+Date.now()+'@example.test';
 const requests=[];
 page.on('request',req=>{if(req.url().includes('/api/first-deed')||req.url().includes('/rpc/create_wish_with_deed'))requests.push({url:req.url(),body:req.postDataJSON?.()});});
 await page.goto(base);
 await signIn(email);
 await page.getByRole('heading',{name:'My Jinns.'}).waitFor();
 await page.getByRole('button',{name:'Jinn home'}).click();
 const wish='I would like a useful starting document for a personal project';
 await page.locator('#wish').fill(wish);
 await page.getByRole('button',{name:'Continue with Jinn'}).click();
 await page.getByRole('button',{name:'Other',exact:true}).waitFor();
 assert.equal(requests.filter(req=>req.body?.mode==='plan').length,1,
  'A first Wish must not make duplicate paid planning calls under React StrictMode');
 assert.equal(await page.locator('.first-value-question').count(),1,'Question leads, not a fixed artifact type');
 assert.equal(await page.getByRole('button',{name:'Skip'}).count(),1);
 assert.equal(await page.getByRole('button',{name:'I’m not sure'}).count(),1);
 await page.screenshot({path:out+'/first-question-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Other'}).click();
 await page.locator('#first-other').fill('A calm practical first step');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Let Jinn prepare it'}).waitFor();
 await page.screenshot({path:out+'/deed-proposal-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Let Jinn prepare it'}).click();
 await page.locator('.first-value-reader h2').waitFor();
 const document=await page.locator('.first-value-prose').innerText();
 assert.ok(document.length>=260,'First Artifact must contain substantial work, not an empty worksheet');
 assert.equal(await page.locator('.first-value-storage').innerText(),
  'This draft is only in this open session until you keep it.');
 assert.match(await page.locator('.first-value-receipt').innerText(),/PREPARED/);
 assert.match(await page.locator('.first-value-source').innerText(),/Sources and unknowns/);
 assert.equal(await page.locator('.first-value-provenance span').count(),2);
 const headingColor=await page.locator('.first-value-reader h2').evaluate(node=>getComputedStyle(node).color);
 assert.notEqual(headingColor,'rgb(255, 255, 255)','Artifact heading must contrast with light reader');
 await page.screenshot({path:out+'/first-artifact-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:out+'/first-artifact-mobile.png',fullPage:true});
 await page.setViewportSize({width:1350,height:900});
 const savedResponse=page.waitForResponse(resp=>resp.url().includes('/api/first-deed')
   &&resp.request().postDataJSON()?.mode==='save_first_value');
 await page.getByRole('button',{name:/Keep this wish/}).click();
 const saved=await savedResponse;
 if(!saved.ok())throw new Error('Verified save rejected: '+JSON.stringify(await saved.json()).slice(0,350));
 const id=(await saved.json()).wishId;
 assert.ok(/^[a-f0-9-]{36}$/.test(id));
 await page.getByText('Continue your wish.',{exact:true}).waitFor();
 assert.equal(await page.locator('.first-value-reader h2').innerText(),'Your first usable draft');
 assert.match(await page.locator('.first-value-storage').innerText(),/Saved privately/);
 assert.ok(!requests.some(r=>r.url.includes('/rpc/create_wish_with_deed')),'Old untrusted receipt write path must not be used');
 const savedUrl=page.url();
 assert.match(savedUrl,/wish=/);
 await page.reload();
 await page.locator('.first-value-reader h2').waitFor();
 assert.ok((await page.locator('.first-value-prose').innerText()).length>=260);
 await page.getByRole('button',{name:'Edit artifact'}).click();
 const textArea=page.locator('.first-value-section textarea').first();
 await textArea.fill('This correction is authored by the user, not Jinn.');
 await page.getByRole('button',{name:'Save corrections'}).click();
 await page.getByRole('button',{name:'Corrections saved'}).waitFor();
 await page.reload();
 await page.locator('.first-value-reader h2').waitFor();
 assert.match(await page.locator('.first-value-prose').innerText(),/This correction is authored by the user/);
 await page.screenshot({path:out+'/saved-return-desktop.png',fullPage:true});

 // Return with another session and account - owner-only RLS remains authoritative.
 await page.getByRole('button',{name:'Sign out'}).click();
 await page.goto(savedUrl);
 await page.locator('#auth-email').waitFor();
 await signIn(email,false);
 await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
 await page.goto(savedUrl);
 await page.locator('.first-value-reader').waitFor();
 assert.match(await page.locator('.first-value-prose').innerText(),/authored by the user/);
 await page.getByRole('button',{name:'Sign out'}).click();
 await page.goto(savedUrl);
 await page.locator('#auth-email').waitFor();
 const another='first-value-second-'+Date.now()+'@example.test';
 await signIn(another,false);
 await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
 await page.goto(savedUrl);
 await page.getByText(/saved wish is unavailable|Could not load wish/i).first().waitFor();
 assert.equal(await page.locator('.first-value-reader').count(),0);
 console.log('PASS: real local Auth/DB First Value plan -> Other -> substantive artifact -> signed save -> reload/edit/return -> owner isolation');
}catch(error){
 console.error(error);
 console.error((await page.locator('body').innerText()).slice(0,2800));
 throw error;
}finally{await context.close();await browser.close();}
