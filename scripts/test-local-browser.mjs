import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
const base=process.env.F03_WEB_URL||'http://127.0.0.1:5173/';
const bundle=await (await fetch(new URL('/src/supabaseClient.ts',base))).text();
if(!bundle.includes('http://127.0.0.1:54321'))throw new Error('Refusing browser test: Vite is not pointed at local Supabase.');
const chrome=process.env.CHROME_PATH||[
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome','/usr/bin/chromium'
].find(existsSync);
if(!chrome)throw new Error('Set CHROME_PATH to a local Chrome executable.');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const dir=process.env.F03_SCREENSHOT_DIR||new URL('../docs/evidence/f03/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const rest='http://127.0.0.1:54321/rest/v1';
const schemaFailure=code=>({status:400,json:{code,message:'fixture private row text'}});
const schemaNotice=page.getByRole('alert').filter({hasText:'missing the Wish workspace schema'});
let clarificationAvailable=false;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const artifact=(sourceNote='',title='Family story starter kit')=>({title,sourceNote,sections:[
 {type:'document',title:'Story seed',body:'Start with the memory you supplied. Add what happened in your own words.'},
 {type:'questions',title:'Interview prompts',items:['What happened before or after?','Who else might remember it?','What detail matters to you?']}],
 unknowns:['The date is unknown.'],nextDeed:{title:'Add one detail',why:'It makes the story seed more useful.',prompt:'Write one detail you remember.'},
 boundary:'Private draft only. No one was contacted or facts verified.'});
const receipt=(operation='AI generated and checked an editable draft against supplied facts')=>({status:'PREPARED',operation,recordedAt:new Date().toISOString(),scope:'Private draft only. No external action, source verification or cross-wish memory.'});
await page.route('**/api/first-deed',async route=>{
 const req=route.request().postDataJSON();
 if(req.mode==='clarify')return clarificationAvailable
  ? route.fulfill({status:200,json:{question:'What is one memory you want to keep?'}})
  : route.fulfill({status:503,json:{error:'AI drafting is unavailable because the server is missing its AI provider key.',code:'ai_not_configured'}});
 const source=req.mode==='continue'?'Sunday pancakes with Aunt':req.answer||'';
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({artifact:artifact(source,req.mode==='continue'?'Family story follow-up kit':'Family story starter kit'),receipt:receipt(req.mode==='continue'?'AI prepared a follow-up draft from the saved, corrected artifact':undefined)})});
});
const snap=async(name,width,height)=>{await page.setViewportSize({width,height});await wait(250);await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});};
let priorMailIds=new Set();
const markMail=async()=>{const list=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();priorMailIds=new Set((list.messages||[]).map(m=>m.ID));};
const code=async()=>{
 for(let attempt=0;attempt<25;attempt++){
  const list=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  const message=list.messages?.find(m=>!priorMailIds.has(m.ID)&&m.To?.some(t=>t.Address===email));
  if(message){const details=await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
   const match=(details.HTML||details.Text||'').match(/\b(\d{6})\b/);if(match)return match[1];}
  await wait(300);
 }
 throw new Error('OTP did not arrive in local Mailpit');
};
const email=`f03-local-${Date.now()}@example.test`;
try{
 await page.goto(base);
 await page.getByRole('heading',{name:/What would you/}).waitFor();
 await snap('welcome-desktop',1440,900);await snap('welcome-mobile',390,844);
 await page.setViewportSize({width:1440,height:900});
 await page.locator('#wish').fill('I want to make a family story book');
 const clarifyFailure=page.waitForEvent('console',{predicate:message=>message.type()==='error'&&message.text().includes('[Wisht] deed.clarify.failed')});
 await page.getByRole('button',{name:/Continue with Jinn/}).click();
 await page.getByRole('alert').filter({hasText:'missing its AI provider key'}).waitFor();
 assert.equal((await (await clarifyFailure).args()[1].jsonValue()).code,'ai_not_configured');
 assert.equal(await page.getByRole('button',{name:/Prepare my first deed/}).count(),0);
 clarificationAvailable=true;
 await page.getByRole('button',{name:'Retry starting wish'}).click();
 await page.getByText('What is one memory you want to keep?').waitFor();
 await snap('clarification-desktop',1440,900);await snap('clarification-mobile',390,844);
 await page.locator('#first-answer').fill('Sunday pancakes with Grandma');
 await page.getByRole('button',{name:/Prepare my first deed/}).click();
 await page.getByText('Your first Deed.',{exact:true}).waitFor();
 await snap('first-deed-desktop',1440,900);await snap('first-deed-mobile',390,844);
 await page.getByRole('button',{name:/Keep this wish/}).click();
 await page.locator('#auth-email').fill(email);
 await markMail();
 await page.getByRole('button',{name:/Send a sign-in code/}).click();
 await page.getByRole('link',{name:'local inbox (Mailpit)'}).waitFor();
 const verifyFailure=page.waitForEvent('console',{predicate:message=>message.type()==='error'&&message.text().includes('[Wisht] auth.otp.verify.failed')});
 await page.route('http://127.0.0.1:54321/auth/v1/verify',route=>route.fulfill({
  status:403,json:{error_code:'otp_expired',msg:'Code rejected'},
 }),{times:1});
 await page.locator('#auth-code').fill('000000');
 await page.getByRole('button',{name:/Verify and continue/}).click();
 assert.equal((await (await verifyFailure).args()[1].jsonValue()).status,403);
 await page.getByRole('alert').filter({hasText:'Code rejected'}).waitFor();
 await page.locator('#auth-code').fill(await code());
 await page.getByRole('button',{name:/Verify and continue/}).click();
 const saveFailure=page.waitForEvent('console',{predicate:message=>message.type()==='error'&&message.text().includes('[Wisht] wish.save.failed')});
 await page.route(`${rest}/rpc/create_wish_with_deed`, route=>route.fulfill(schemaFailure('PGRST202')), {times:1});
 await page.getByRole('button',{name:/Keep this wish/}).click();
 await schemaNotice.waitFor();
 const saveDetails=await (await saveFailure).args()[1].jsonValue();
 assert.equal(saveDetails.step,'create_wish_with_deed');
 assert.equal(saveDetails.code,'PGRST202');
 assert.doesNotMatch(JSON.stringify(saveDetails),/fixture private row text/);
 assert.equal(await page.locator('#first-source-note').inputValue(),'Sunday pancakes with Grandma');

 // A committed save followed by a failed read should retry opening the saved ID.
 const openRequest=url=>url.href.startsWith(`${rest}/wish_records?`)&&url.searchParams.get('select')==='id,original_intent';
 await page.route(openRequest,route=>route.fulfill(schemaFailure('42703')));
 const savedLog=page.waitForEvent('console',{predicate:message=>message.text().includes('[Wisht] wish.save.succeeded')});
 await page.getByRole('button',{name:/Keep this wish/}).click();
 await savedLog;
 await page.getByRole('button',{name:'Retry opening wish'}).waitFor();
 assert.ok(new URL(page.url()).searchParams.get('wish'));
 assert.equal(await page.getByRole('button',{name:/Keep this wish/}).count(),0);
 await page.unroute(openRequest);
 await page.getByRole('button',{name:'Retry opening wish'}).click();
 await page.locator('#first-source-note').waitFor();

 const listRequest=url=>url.href.startsWith(`${rest}/wish_records?`)&&url.searchParams.get('select')?.includes('updated_at');
 await page.route(listRequest,route=>route.fulfill(schemaFailure('42703')));
 const listFailure=page.waitForEvent('console',{predicate:message=>message.type()==='error'&&message.text().includes('[Wisht] wish.list.failed')});
 await page.getByRole('banner').getByRole('button',{name:'My wishes'}).click();
 await schemaNotice.waitFor();
 const listDetails=await (await listFailure).args()[1].jsonValue();
 assert.equal(listDetails.step,'read wishes');
 assert.equal(listDetails.code,'42703');
 assert.equal(await page.getByText('No saved wishes yet.',{exact:false}).count(),0);
 assert.equal(await page.locator('.my-work-section-header span').count(),0);
 await page.unroute(listRequest);
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await page.getByRole('button',{name:/I want to make a family story book/}).waitFor();
 assert.equal(await page.locator('.my-work-card').count(),1);
 await snap('return-desktop',1440,900);await snap('return-mobile',390,844);
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:/I want to make a family story book/}).click();
 await page.locator('#first-source-note').fill('Sunday pancakes with Aunt');
 await page.locator('#first-source-note').blur();
 await page.getByRole('button',{name:/Save corrections/}).click();
 await page.getByRole('button',{name:'Corrections saved'}).waitFor();
 await page.reload();
 await page.locator('#first-source-note').waitFor();
 if(await page.locator('#first-source-note').inputValue()!=='Sunday pancakes with Aunt')throw new Error('Correction did not persist on reload');
 await page.getByRole('button',{name:/Prepare next Deed/}).click();
 await page.getByText('Earlier Deeds').waitFor();
 const savedUrl=page.url();
 await page.getByRole('button',{name:'Sign out'}).click();
 await page.goto(savedUrl);
 await page.locator('#auth-email').fill(email);
 await markMail();
 await page.getByRole('button',{name:/Send a sign-in code/}).click();
 await page.locator('#auth-code').fill(await code());
 await page.getByRole('button',{name:/Verify and continue/}).click();
 await page.getByText('Earlier Deeds').waitFor();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/Delete wish and artifact/}).click();
 await page.getByText('No saved wishes yet').waitFor();
 console.log('PASS: drafting and OTP diagnostics, real local OTP, save/open/list retries, edit, second Deed, return and delete');
}catch(error){console.error(error);console.log((await page.locator('body').innerText()).slice(0,3000));throw error;}
finally{await context.close();await browser.close();}
