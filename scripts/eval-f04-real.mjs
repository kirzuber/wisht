import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:5573/';
const inbox='http://127.0.0.1:55324';
const health=await (await fetch('http://127.0.0.1:3301/api/health')).json();
assert.equal(health.localFirstValueSigningReady,true);
assert.equal(health.localModelFixtureEnabled,false);
assert.ok((await (await fetch(base+'src/supabaseClient.ts')).text()).includes('127.0.0.1:55321'));
const chrome=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome);
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(120000);
page.on('response',response=>{if(response.url().includes('/auth/v1/verify'))
  console.log('local OTP verify HTTP',response.status());});
const evidence=new URL('../docs/evidence/f04-001/',import.meta.url);
const prior=process.env.F04_RESUME==='1'?
  JSON.parse(readFileSync(new URL('../docs/evidence/f04-001/actual-provider-evaluation.json',import.meta.url),'utf8')):null;
const result=prior||{kind:'F04 approved synthetic Aunt real-provider local evaluation',
  timestamp:new Date().toISOString(),provider:'DeepSeek deepseek-flash',
  payloadScope:'Only synthetic Sunday pancakes with Aunt life-story case',
  stack:'Isolated local Supabase 55321/55322',durationsMs:{},checks:[],ids:{},error:null};
const check=(label,value)=>{assert.ok(value,label);result.checks.push(label)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wish='I want to write my life story. My one confirmed memory is Sunday pancakes with Aunt.';
const editRequest='Write a 150–250-word first-chapter opening using only my confirmed Sunday pancakes with Aunt memory. Keep the scene spare; leave other people, places, dates, sensory details and interviews unknown.';
try{
  let started;
  await page.goto(base);
  const messages=(await (await fetch(inbox+'/api/v1/messages')).json()).messages;
  const email=prior?messages.find(m=>m.To?.some(to=>to.Address?.startsWith('f04-real-aunt-')))?.To.find(to=>to.Address?.startsWith('f04-real-aunt-')).Address:
    'f04-real-aunt-'+Date.now()+'@example.test';
  assert.ok(email,'synthetic account absent');
  const before=new Set((await (await fetch(inbox+'/api/v1/messages')).json()).messages.map(m=>m.ID));
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#auth-email').fill(email);
  await page.getByRole('button',{name:/Send a sign-in code/}).click();
  let code;
  for(let i=0;i<60;i++){
    const list=(await (await fetch(inbox+'/api/v1/messages')).json()).messages;
    const mail=list.find(m=>!before.has(m.ID)&&m.To?.some(to=>to.Address===email));
    if(mail){const full=await (await fetch(inbox+'/api/v1/message/'+mail.ID)).json();
      code=(full.HTML||full.Text||'').match(/\b(\d{6})\b/)?.[1];if(code)break;}
    await sleep(250);
  }
  assert.ok(code,'local OTP absent');
  await page.locator('#auth-code').fill(code);
  await page.getByRole('button',{name:/Verify and continue/}).click();
  await Promise.race([
    page.getByRole('button',{name:'Jinn home'}).waitFor(),
    page.getByRole('alert').waitFor().then(async()=>{throw Error('Local OTP UI: '+await page.getByRole('alert').innerText());}),
  ]);
  if(prior){
    await page.goto(base+'?wish='+result.ids.wishId);
    await page.getByRole('button',{name:'Review next Deed'}).waitFor();
  }else{
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.locator('#wish').fill(wish);
  started=Date.now();
  const planning=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&r.request().postDataJSON()?.mode==='plan');
  await page.getByRole('button',{name:'Continue with Jinn'}).click();
  const planResponse=await planning;result.durationsMs.initialPlan=Date.now()-started;
  assert.equal(planResponse.status(),200,'initial plan HTTP '+planResponse.status());
  result.initialPlan=(await planResponse.json()).plan;
  for(let i=0;i<(result.initialPlan.questions||[]).length;i++)await page.getByRole('button',{name:'Skip',exact:true}).click();
  started=Date.now();
  const preparing=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&r.request().postDataJSON()?.mode==='prepare');
  await page.getByRole('button',{name:'Let Jinn prepare it'}).click();
  const preparedResponse=await preparing;result.durationsMs.initialPrepare=Date.now()-started;
  assert.equal(preparedResponse.status(),200,'initial prepare HTTP '+preparedResponse.status());
  const prepared=await preparedResponse.json();
  result.initialArtifact=prepared.artifact;result.initialReceipt=prepared.receipt;
  check('real provider prepared first private Artifact',prepared.receipt.status==='PREPARED');
  const saving=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&r.request().postDataJSON()?.mode==='save_first_value');
  await page.getByRole('button',{name:'Keep this wish'}).click();
  const savedResponse=await saving;
  assert.equal(savedResponse.status(),200,'initial save HTTP '+savedResponse.status());
  result.ids.wishId=(await savedResponse.json()).wishId;
  await page.getByRole('button',{name:'Review next Deed'}).waitFor();
  }
  if(prior&&process.env.F04_REOPEN_ONLY==='1'){
    await page.reload();
    await page.locator('.first-value-reader').waitFor();
    check('second Artifact reopens after refresh',
      await page.locator('.first-value-reader h2').innerText()===result.secondArtifact.title);
    const chapter=result.secondArtifact.sections.find(s=>s.type==='document')?.body||'';
    result.documentWordCount=chapter.trim().split(/\s+/).length;
    check('requested 150–250 word chapter opening',result.documentWordCount>=150&&result.documentWordCount<=250);
    check('no unsupported maker, kitchen or ritual claim',
      !/Aunt (made|cooked)|Aunt, in (her|the) kitchen|Sunday (came|always meant)|was a ritual|fact of her/i.test(chapter));
    await page.screenshot({path:new URL('actual-provider-second-artifact.png',evidence).pathname,fullPage:true});
    result.error=null;
    console.log('F04 synthetic Aunt real-provider reopen and quality checks: PASS');
  }else{
  await page.locator('.continuation-context summary').click();
  if(await page.getByRole('button',{name:'Review next Deed'}).isDisabled()){
    await page.getByRole('button',{name:'Save confirmed context'}).click();
    await page.getByRole('button',{name:'Review next Deed'}).waitFor();
  }
  started=Date.now();
  const proposing=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&r.request().postDataJSON()?.mode==='propose_continuation');
  await page.getByRole('button',{name:'Review next Deed'}).click();
  const proposalResponse=await proposing;result.durationsMs.continuationProposal=Date.now()-started;
  assert.equal(proposalResponse.status(),200,'proposal HTTP '+proposalResponse.status());
  await page.locator('#continuation-edit-request').fill(editRequest);
  started=Date.now();
  const updating=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&r.request().postDataJSON()?.mode==='propose_continuation'&&r.request().postDataJSON()?.editRequest===editRequest);
  await page.getByRole('button',{name:'Update proposal'}).click();
  const updatedResponse=await updating;result.durationsMs.editedProposal=Date.now()-started;
  assert.equal(updatedResponse.status(),200,'edited proposal HTTP '+updatedResponse.status());
  result.reviewedProposal=(await updatedResponse.json()).plan;
  check('reviewed plan is private',result.reviewedProposal.deed.scope==='PRIVATE_DRAFT');
  started=Date.now();
  const executing=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&r.request().postDataJSON()?.mode==='execute_continuation');
  await page.getByRole('button',{name:'Start Deed'}).click();
  const executeResponse=await executing;result.durationsMs.continuationExecute=Date.now()-started;
  assert.equal(executeResponse.status(),200,'execute HTTP '+executeResponse.status()+': '+JSON.stringify(await executeResponse.json()));
  const execution=await executeResponse.json();
  result.ids.secondDeedId=execution.deedId;result.ids.secondArtifactId=execution.artifactId;
  result.continuationReceipt=execution.receipt;
  check('verified PREPARED second Deed',execution.receipt?.status==='PREPARED'&&execution.receipt?.verified===true);
  await page.locator('.first-value-reader').waitFor();
  const second=await page.evaluate(async()=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const db=getSupabase();const {data:{user}}=await db.auth.getUser();
    const wishId=new URL(location.href).searchParams.get('wish');
    const [a,d]=await Promise.all([
      db.from('artifacts').select('id,origin_deed_id,content').eq('wish_id',wishId).eq('user_id',user.id),
      db.from('deeds').select('id,verified_followup,actor_jinn_name,receipt').eq('wish_id',wishId).eq('user_id',user.id),
    ]);return {artifacts:a.data,deeds:d.data};
  });
  result.secondArtifact=second.artifacts.find(a=>a.id===execution.artifactId)?.content;
  result.database={artifactCount:second.artifacts.length,deedCount:second.deeds.length,
    verifiedFollowups:second.deeds.filter(d=>d.verified_followup).length};
  check('two independent Artifact and Deed rows',second.artifacts.length===2&&second.deeds.length===2);
  check('second Artifact is distinct',second.artifacts[0].id!==second.artifacts[1].id);
  check('second Deed has server marker',second.deeds.some(d=>d.id===execution.deedId&&d.verified_followup));
  const document=result.secondArtifact.sections.find(s=>s.type==='document')?.body||'';
  result.documentWordCount=document.trim().split(/\s+/).length;
  check('requested 150–250 word chapter opening',result.documentWordCount>=150&&result.documentWordCount<=250);
  check('Aunt fact present',document.includes('Aunt'));
  check('no invented relatives or interviews',!/(Grandma|grandmother|interviewed|spoke to my|according to my)/i.test(document));
  check('no unsupported maker, kitchen or ritual claim',
    !/Aunt (made|cooked)|Aunt, in (her|the) kitchen|Sunday (came|always meant)|was a ritual|fact of her/i.test(document));
  await page.screenshot({path:new URL('actual-provider-second-artifact.png',evidence).pathname,fullPage:true});
  await page.reload();
  await page.locator('.first-value-reader').waitFor();
  check('second Artifact reopens after refresh',await page.locator('.first-value-reader h2').innerText()===result.secondArtifact.title);
  result.error=null;
  console.log('F04 synthetic Aunt real-provider local evaluation: PASS');
  }
}catch(error){
  result.error=error instanceof Error?error.message:String(error);
  console.error(result.error);
  console.error((await page.locator('body').innerText()).slice(0,1200));
  process.exitCode=1;
}finally{
  writeFileSync(new URL('actual-provider-evaluation.json',evidence),JSON.stringify(result,null,2)+'\n');
  await browser.close();
}
