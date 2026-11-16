/**
 * F03-004 actual-provider browser smoke — manually run against the LOCAL API.
 * Uses a known, published demonstration Wish only; never the blind Wish.
 * Requires local Supabase/OTP + real configured provider; refuses model fixtures
 * and any hosted Supabase. Creates only disposable local test records.
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

if(process.env.JINN_TEST_MODE==='1'||process.env.JINN_LOCAL_MODEL_ENDPOINT)
  throw Error('Actual-provider smoke must not use a deterministic model fixture.');
const base='http://127.0.0.1:5173/';
const api='http://127.0.0.1:3001/';
const health=await (await fetch(api+'api/health')).json();
if(health.localFirstValueSigningReady!==true || health.localModelFixtureEnabled!==false)
  throw Error('Expected local signing readiness with a real model (not fixture); check root npm run dev and api/health.');
const bundle=await (await fetch(base+'src/supabaseClient.ts')).text();
if(!bundle.includes('http://127.0.0.1:54321'))
  throw Error('Refusing a live-model browser run without local Supabase.');
const chrome=process.env.CHROME_PATH||[
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome','/usr/bin/chromium',
].find(existsSync);
if(!chrome)throw Error('Set CHROME_PATH to your locally installed Chrome.');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(90000);
const results={kind:'F03-004 actual-provider browser and local Auth/DB smoke',
  source:'Known public demo Wish, NOT an independent blind Wish',
  timestamp:new Date().toISOString(),
  mode:'real model; deterministic fixtures rejected',
  checks:[],firstPlan:null,firstArtifact:null,receipt:null,
  durationsMs:{},error:null,limitations:['Content usefulness requires separate human review']};
const evidenceDir=new URL('../docs/evidence/f03-004/',import.meta.url);
mkdirSync(evidenceDir,{recursive:true});
const record=(label,value)=>results.checks.push({label,passed:Boolean(value)});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mailpit='http://127.0.0.1:54324';
const email='f03-004-provider-'+Date.now()+'@example.test';
const wish='I want a draft introduction for a family story collection';
let preparedResponse,planningResponse;
try{
  await page.goto(base);
  const before=new Set((await (await fetch(mailpit+'/api/v1/messages')).json()).messages.map(m=>m.ID));
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#auth-email').fill(email);
  await page.getByRole('button',{name:/Send a sign-in code/}).click();
  let code;
  for(let i=0;i<50;i++){
    const list=(await (await fetch(mailpit+'/api/v1/messages')).json()).messages;
    const message=list.find(m=>!before.has(m.ID)&&m.To?.some(to=>to.Address===email));
    if(message){
      const full=await (await fetch(mailpit+'/api/v1/message/'+message.ID)).json();
      code=(full.HTML||full.Text||'').match(/\b(\d{6})\b/)?.[1];
      if(code)break;
    }
    await sleep(250);
  }
  assert.ok(code,'Local OTP did not arrive in Mailpit');
  await page.locator('#auth-code').fill(code);
  await page.getByRole('button',{name:/Verify and continue/}).click();
  await page.getByRole('heading',{name:'My Jinns.'}).waitFor();
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.locator('#wish').fill(wish);
  const planningStarted=Date.now();
  const planPromise=page.waitForResponse(res=>
    res.url().includes('/api/first-deed') && res.request().postDataJSON()?.mode==='plan');
  await page.getByRole('button',{name:'Continue with Jinn'}).click();
  const planResponse=await planPromise;
  results.durationsMs.planning=Date.now()-planningStarted;
  if(!planResponse.ok())throw Error('Real planning failed: HTTP '+planResponse.status());
  planningResponse=await planResponse.json();
  assert.equal(planningResponse.plan?.locale,'en');
  results.firstPlan=planningResponse.plan;
  const questions=planningResponse.plan.questions||[];
  for(let i=0;i<questions.length;i++){
    await page.getByRole('button',{name:'Skip',exact:true}).click();
  }
  await page.getByRole('button',{name:'Let Jinn prepare it'}).waitFor();
  const preparePromise=page.waitForResponse(res=>res.url().includes('/api/first-deed')&&
    res.request().postDataJSON()?.mode==='prepare');
  const preparationStarted=Date.now();
  await page.getByRole('button',{name:'Let Jinn prepare it'}).click();
  const prepareResponse=await preparePromise;
  results.durationsMs.prepare=Date.now()-preparationStarted;
  if(!prepareResponse.ok())throw Error('Actual-provider preparation failed: HTTP '+prepareResponse.status());
  preparedResponse=await prepareResponse.json();
  const artifact=preparedResponse.artifact;
  results.firstArtifact=artifact;
  results.receipt=preparedResponse.receipt;
  const main=artifact.sections.filter(s=>s.type==='document').map(s=>s.body).join('\n');
  assert.ok(main.length>=260,'The actual provider did not produce a substantial first Artifact.');
  assert.equal(preparedResponse.receipt.status,'PREPARED');
  assert.notEqual(preparedResponse.receipt.draftSource,'worksheet');
  record('actual provider produced a substantive editable document',true);
  record('no external action claimed as executed',/private|no external action/i.test(preparedResponse.receipt.scope));
  await page.locator('.first-value-reader').waitFor();
  await page.screenshot({path:new URL('actual-provider-browser-artifact.png',evidenceDir).pathname,fullPage:true});
  const savedResponsePromise=page.waitForResponse(res=>res.url().includes('/api/first-deed')&&
    res.request().postDataJSON()?.mode==='save_first_value');
  await page.getByRole('button',{name:/Keep this wish/}).click();
  const savedResponse=await savedResponsePromise;
  if(!savedResponse.ok())throw Error('Actual-provider save failed: HTTP '+savedResponse.status());
  const saved=(await savedResponse.json()).wishId;
  assert.match(saved,/^[a-f0-9-]{36}$/i);
  record('authenticated verified server save',true);
  await page.locator('.first-value-reader').waitFor();
  const savedUrl=page.url();
  await page.reload();
  await page.locator('.first-value-reader').waitFor();
  assert.ok((await page.locator('.first-value-prose').innerText()).length>=260);
  record('saved artifact reopened after reload',true);
  await page.screenshot({path:new URL('actual-provider-browser-saved.png',evidenceDir).pathname,fullPage:true});
  results.savedWishId=saved;
  results.savedUrlPath=new URL(savedUrl).pathname+new URL(savedUrl).search;
  console.log('PASS: actual provider plan/preparation, meaningful document floor, local signed save and reopen');
}catch(error){
  results.error=error instanceof Error?error.message:String(error);
  console.error(results.error);
  console.error((await page.locator('body').innerText()).slice(0,1800));
  process.exitCode=1;
}finally{
  await browser.close();
  writeFileSync(new URL('actual-provider-browser-evaluation.json',evidenceDir),
    JSON.stringify(results,null,2)+'\n');
}
