// Disposable local Supabase + deterministic model transport acceptance.
// This proves Auth, API, persistence and UI wiring, not real-model prose quality.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:5573/';
const inbox='http://127.0.0.1:55324';
const health=await (await fetch('http://127.0.0.1:3301/api/health')).json();
assert.equal(health.localModelFixtureEnabled,true);
assert.equal(health.localFirstValueSigningReady,true);
const bundle=await (await fetch(base+'src/supabaseClient.ts')).text();
assert.ok(bundle.includes('127.0.0.1:55321'),'Browser must use isolated local Supabase');
const chrome=process.env.CHROME_PATH||[
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium',
].find(existsSync);
if(!chrome)throw Error('Chrome is required for local browser acceptance.');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(45000);
const evidence=new URL('../docs/evidence/f04-001/',import.meta.url);
mkdirSync(evidence,{recursive:true});
const results={kind:'F04 deterministic local Auth, SQL and browser acceptance',
  provider:'loopback fixture only',checks:[],ids:{},screenshots:[],limitations:[
    'Deterministic fixture output is not real-model usefulness evidence',
  ]};
const check=(name,value)=>{assert.ok(value,name);results.checks.push(name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function signIn(email,fromGuest=true){
  const before=new Set((await (await fetch(inbox+'/api/v1/messages')).json()).messages.map(m=>m.ID));
  if(fromGuest)await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#auth-email').fill(email);
  await page.getByRole('button',{name:/Send a sign-in code/}).click();
  let code;
  for(let i=0;i<50;i++){
    const list=(await (await fetch(inbox+'/api/v1/messages')).json()).messages;
    const mail=list.find(m=>!before.has(m.ID)&&m.To?.some(to=>to.Address===email));
    if(mail){const full=await (await fetch(inbox+'/api/v1/message/'+mail.ID)).json();
      code=(full.HTML||full.Text||'').match(/\b(\d{6})\b/)?.[1];if(code)break;}
    await sleep(250);
  }
  assert.ok(code,'Local OTP absent');
  await page.locator('#auth-code').fill(code);
  await page.getByRole('button',{name:/Verify and continue/}).click();
  await page.getByRole('button',{name:'Sign out'}).waitFor();
}
async function firstWish(wish){
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.locator('#wish').fill(wish);
  await page.getByRole('button',{name:/^Continue with /}).click();
  await page.getByRole('button',{name:'Skip',exact:true}).click();
  await page.getByRole('button',{name:'Let Jinn prepare it'}).click();
  await page.locator('.first-value-reader').waitFor();
  const save=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&
    r.request().postDataJSON()?.mode==='save_first_value');
  await page.getByRole('button',{name:'Keep this wish'}).click();
  const response=await save;
  assert.equal(response.status(),200,JSON.stringify(await response.json()));
  await page.getByRole('button',{name:'Review next Deed'}).waitFor();
  return (await response.json()).wishId;
}
async function continuation(editRequest=''){
  const review=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&
    r.request().postDataJSON()?.mode==='propose_continuation');
  await page.getByRole('button',{name:'Review next Deed'}).click();
  const reviewed=await review;
  assert.equal(reviewed.status(),200,JSON.stringify(await reviewed.json()));
  let proposal=await reviewed.json();
  check('reviewed private plan',proposal.plan.deed.scope==='PRIVATE_DRAFT');
  if(editRequest){
    await page.locator('#continuation-edit-request').fill(editRequest);
    const update=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&
      r.request().postDataJSON()?.mode==='propose_continuation'&&
      r.request().postDataJSON()?.editRequest===editRequest);
    await page.getByRole('button',{name:'Update proposal'}).click();
    const updated=await update;
    assert.equal(updated.status(),200);
    proposal=await updated.json();
    check('edited request bound to reviewed plan',proposal.editRequest===editRequest);
  }
  const execute=page.waitForResponse(r=>r.url().includes('/api/first-deed')&&
    r.request().postDataJSON()?.mode==='execute_continuation');
  await page.getByRole('button',{name:'Start Deed'}).click();
  const executed=await execute;
  assert.equal(executed.status(),200,JSON.stringify(await executed.json()));
  await page.getByText('Your next private document',{exact:true}).waitFor();
  return {...await executed.json(),requestBody:executed.request().postDataJSON()};
}
try{
  const email='f04-browser-'+Date.now()+'@example.test';
  await page.goto(base);await signIn(email);
  const wishId=await firstWish('Write my life story');
  results.ids.wishId=wishId;
  const first=await page.evaluate(async()=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const db=getSupabase();const {data:{user}}=await db.auth.getUser();
    const {data}=await db.from('artifacts').select('id,content,origin_deed_id,version')
      .eq('wish_id',new URL(location.href).searchParams.get('wish')).eq('user_id',user.id);
    return data[0];
  });
  results.ids.firstArtifactId=first.id;
  const firstActor=await page.evaluate(async()=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const db=getSupabase();const wishId=new URL(location.href).searchParams.get('wish');
    const {data:deed,error}=await db.from('deeds').select('actor_jinn_id,actor_jinn_name,verified_first')
      .eq('wish_id',wishId).single();
    if(error)throw error;
    return deed;
  });
  check('First Deed saves actual Jinn ID and name',Boolean(firstActor.actor_jinn_id&&firstActor.actor_jinn_name&&firstActor.verified_first));
  await page.getByRole('button',{name:'Edit artifact'}).click();
  await page.locator('#first-source-note').fill('Sunday pancakes with Grandma');
  await page.locator('#first-source-note').blur();
  await page.getByRole('button',{name:'Save corrections'}).click();
  await page.getByRole('button',{name:'Corrections saved'}).waitFor();
  await page.locator('#first-source-note').fill('Sunday pancakes with Aunt');
  await page.locator('#first-source-note').blur();
  await page.getByRole('button',{name:'Save corrections'}).click();
  await page.getByRole('button',{name:'Corrections saved'}).waitFor();
  check('source correction retained',await page.locator('#first-source-note').inputValue()==='Sunday pancakes with Aunt');
  const second=await continuation();
  results.ids.secondArtifactId=second.artifactId;
  results.ids.secondDeedId=second.deedId;
  check('distinct Artifact ID',first.id!==second.artifactId);
  check('server PREPARED receipt after save',second.receipt.status==='PREPARED'&&second.receipt.verified===true);
  check('no superseded Grandma claim',!(await page.locator('.first-value-prose').innerText()).includes('Grandma'));
  const chapter=await page.locator('.first-value-prose').innerText();
  check('deterministic chapter length',chapter.trim().split(/\s+/).length>=150&&chapter.trim().split(/\s+/).length<=250);
  check('deterministic chapter uses Aunt only',chapter.includes('Sunday pancakes with Aunt')&&!/Grandma|kitchen|city|interview/i.test(chapter));
  check('third suggestion advances',await page.getByRole('heading',{name:'Choose another confirmed direction'}).count()>0);
  const replay=await page.evaluate(async body=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const response=await fetch('/api/first-deed',{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});
    return {status:response.status,result:await response.json()};
  },second.requestBody);
  check('replay returns same IDs',replay.status===200&&replay.result.deedId===second.deedId&&replay.result.artifactId===second.artifactId);
  const recovery=await page.evaluate(async body=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const response=await fetch('/api/first-deed',{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({mode:'resolve_continuation',
      locale:body.locale,wishId:body.wishId,requestKey:body.requestKey,
      proposal:body.proposal,editRequest:body.editRequest})});
    return {status:response.status,result:await response.json()};
  },second.requestBody);
  check('lost HTTP response recovery returns original IDs',recovery.status===200&&
    recovery.result.deedId===second.deedId&&recovery.result.artifactId===second.artifactId);
  const conflict=await page.evaluate(async body=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const headers={'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`};
    const review=await fetch('/api/first-deed',{method:'POST',headers,body:JSON.stringify({
      mode:'propose_continuation',locale:body.locale,wishId:body.wishId,
      editRequest:'Write a different approved chapter'})});
    if(!review.ok)throw new Error('Conflict proposal failed: '+await review.text());
    const proposal=await review.json();
    const response=await fetch('/api/first-deed',{method:'POST',headers,body:JSON.stringify({
      ...body,sourceId:proposal.snapshot.sourceId,proposal,editRequest:proposal.editRequest})});
    return {status:response.status,result:await response.json()};
  },second.requestBody);
  check('same key with different signed action returns 409',conflict.status===409&&conflict.result.code==='request_conflict');
  const forged=await page.evaluate(async body=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const response=await fetch('/api/first-deed',{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({...body,
        requestKey:crypto.randomUUID(),receipt:{status:'PREPARED',verified:true},actorJinnId:crypto.randomUUID(),recordedAt:'2000-01-01'})});
    return response.status;
  },second.requestBody);
  check('forged client receipt, actor and time rejected',forged===400);
  await page.locator('.continuation-context summary').click();
  await page.locator('#confirmed-facts').fill('I dropped the last pancake');
  await page.getByRole('button',{name:'Save confirmed context'}).click();
  await page.getByRole('button',{name:'Review next Deed'}).waitFor();
  const stale=await page.evaluate(async body=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const response=await fetch('/api/first-deed',{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({...body,requestKey:crypto.randomUUID()})});
    return response.status;
  },second.requestBody);
  check('stale proposal conflicts after context correction',stale===409);
  const reassigned=await page.evaluate(async ({wishId,firstActor})=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const db=getSupabase();const {data:{user}}=await db.auth.getUser();
    const {data:newJinn,error:createError}=await db.from('jinns').insert({user_id:user.id,
      name:'Later Jinn',is_primary:false}).select('id').single();
    if(createError)throw createError;
    const {error:assignError}=await db.from('wish_records').update({primary_jinn_id:newJinn.id})
      .eq('id',wishId).eq('user_id',user.id);
    if(assignError)throw assignError;
    const {error:renameError}=await db.from('jinns').update({name:'Earlier Jinn renamed'})
      .eq('id',firstActor.actor_jinn_id).eq('user_id',user.id);
    if(renameError)throw renameError;
    return newJinn.id;
  },{wishId,firstActor});
  check('Wish assigned to a different Jinn',Boolean(reassigned));
  await page.locator('.continuation-history summary').focus();
  check('history control receives keyboard focus',await page.locator('.continuation-history summary').evaluate(el=>document.activeElement===el));
  await page.locator('.continuation-history summary').press('Enter');
  check('history opens by keyboard',await page.locator('.continuation-history').evaluate(el=>el.hasAttribute('open')));
  await page.getByRole('button',{name:/1\. Your first usable draft/}).click();
  check('first Artifact independently reopened',await page.locator('.first-value-reader h2').innerText()==='Your first usable draft');
  await page.screenshot({path:new URL('desktop-history.png',evidence).pathname,fullPage:true});
  results.screenshots.push('desktop-history.png');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(150);
  await page.screenshot({path:new URL('mobile-history.png',evidence).pathname,animations:'disabled'});
  results.screenshots.push('mobile-history.png');
  await page.locator('.first-value-reader').evaluate(element=>element.scrollIntoView({block:'start'}));
  await page.waitForTimeout(150);
  await page.screenshot({path:new URL('mobile-artifact.png',evidence).pathname,animations:'disabled'});
  results.screenshots.push('mobile-artifact.png');
  await page.reload();
  await page.locator('.continuation-history summary').waitFor();
  await page.locator('.continuation-history summary').click();
  const labels=await page.locator('.continuation-artifact-list').innerText();
  check('First and second historical names survive reassignment and rename',
    labels.includes(firstActor.actor_jinn_name)&&!labels.includes('Later Jinn')&&!labels.includes('Earlier Jinn renamed'));
  await page.getByRole('button',{name:/1\. Your first usable draft/}).click();
  check('first Artifact after refresh',await page.locator('.first-value-reader h2').innerText()==='Your first usable draft');
  await page.getByRole('button',{name:/2\. Your next private document/}).click();
  check('second Artifact after refresh',await page.locator('.first-value-reader h2').innerText()==='Your next private document');
  await page.getByRole('button',{name:'Edit artifact'}).click();
  const edited=page.locator('.first-value-section textarea').first();
  await edited.fill('A separate correction to the second Artifact. Sunday pancakes with Aunt.');
  await page.getByRole('button',{name:'Save corrections'}).click();
  await page.getByRole('button',{name:'Corrections saved'}).waitFor();
  await page.reload();
  await page.locator('.first-value-reader').waitFor();
  check('second edit persisted', (await page.locator('.first-value-prose').innerText()).includes('separate correction'));
  for(const locale of ['ru','fr','es','en']){
    await page.locator('#ui-language').selectOption(locale);
    await page.locator('.continuation-panel').waitFor();
    check('locale '+locale,await page.locator('.continuation-panel').count()===1);
  }
  const db=await page.evaluate(async()=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const client=getSupabase();const {data:{user}}=await client.auth.getUser();
    const wishId=new URL(location.href).searchParams.get('wish');
    const [a,d,w]=await Promise.all([
      client.from('artifacts').select('id,origin_deed_id,version,content').eq('wish_id',wishId).eq('user_id',user.id),
      client.from('deeds').select('id,verified_first,verified_followup,actor_jinn_id,actor_jinn_name,request_fingerprint,receipt').eq('wish_id',wishId).eq('user_id',user.id),
      client.from('wish_records').select('wish_context').eq('id',wishId).single(),
    ]);
    return {artifacts:a.data,deeds:d.data,context:w.data?.wish_context};
  });
  check('two Artifact and Deed rows',db.artifacts.length===2&&db.deeds.length===2);
  check('context correction wins',db.context.sourceNote==='Sunday pancakes with Aunt');
  check('historical first unchanged',db.artifacts.find(a=>a.id===first.id).origin_deed_id===first.origin_deed_id);
  check('second verified marker',db.deeds.some(d=>d.verified_followup===true&&d.id===second.deedId));
  check('both Deeds retain original Jinn ID and name',db.deeds.every(d=>
    d.actor_jinn_id===firstActor.actor_jinn_id&&d.actor_jinn_name===firstActor.actor_jinn_name));
  check('follow-up fingerprint persisted',db.deeds.find(d=>d.id===second.deedId)?.request_fingerprint?.length===64);
  results.database={artifactCount:db.artifacts.length,deedCount:db.deeds.length,
    contextRevision:db.context.revision,verifiedFollowups:db.deeds.filter(d=>d.verified_followup).length};
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.goto(base+'?wish='+wishId);
  await page.locator('#auth-email').waitFor();
  await signIn(email,false);
  await page.goto(base+'?wish='+wishId);
  await page.locator('.first-value-reader').waitFor();
  check('reauthentication reopened second Artifact',await page.locator('.continuation-history').count()===1);
  await page.locator('.continuation-history summary').click();
  check('historical attribution survives sign out and sign in',
    (await page.locator('.continuation-artifact-list').innerText()).includes(firstActor.actor_jinn_name));
  const gardenId=await firstWish('Start a community garden; landowner permission is unknown');
  const crossWishReplay=await page.evaluate(async ({wishId,requestBody})=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const response=await fetch('/api/first-deed',{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({mode:'resolve_continuation',
      locale:'en',wishId,requestKey:requestBody.requestKey,
      proposal:requestBody.proposal,editRequest:requestBody.editRequest})});
    return response.status;
  },{wishId:gardenId,requestBody:second.requestBody});
  check('request key cannot resolve into another Wish',crossWishReplay===409);
  const garden=await continuation('Keep this as a private unsent permission enquiry draft.');
  const gardenText=await page.locator('.first-value-prose').innerText();
  check('garden has unsent enquiry draft',gardenText.includes('UNSENT PERMISSION ENQUIRY'));
  check('garden makes no permission or sending claim',gardenText.includes('not identified the landowner')&&gardenText.includes('not treat this draft as permission'));
  results.ids.gardenWishId=gardenId;
  results.ids.gardenArtifactId=garden.artifactId;
  await page.screenshot({path:new URL('garden-unsent-draft.png',evidence).pathname,fullPage:true});
  results.screenshots.push('garden-unsent-draft.png');
  const unseenId=await firstWish('Design a weekly practice plan for learning hand lettering');
  const unseen=await continuation();
  check('unseen Wish uses same second-Deed pipeline',Boolean(unseen.deedId&&unseen.artifactId));
  results.ids.unseenWishId=unseenId;
  results.ids.unseenArtifactId=unseen.artifactId;
  const raceWishId=await firstWish('Design a weekly practice plan for learning hand lettering');
  const concurrent=await page.evaluate(async wishId=>{
    const {getSupabase}=await import('/src/supabaseClient.ts');
    const {data:{session}}=await getSupabase().auth.getSession();
    const headers={'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`};
    const review=await fetch('/api/first-deed',{method:'POST',headers,
      body:JSON.stringify({mode:'propose_continuation',locale:'en',wishId})});
    if(!review.ok)throw new Error('Concurrent review failed: '+await review.text());
    const proposal=await review.json();
    const body={mode:'execute_continuation',locale:'en',wishId,
      sourceId:proposal.snapshot.sourceId,requestKey:crypto.randomUUID(),proposal,editRequest:''};
    const requests=await Promise.all([0,1].map(()=>fetch('/api/first-deed',{
      method:'POST',headers,body:JSON.stringify(body)})));
    const results=await Promise.all(requests.map(async response=>({status:response.status,
      payload:await response.json()})));
    const {data:deeds,error}=await getSupabase().from('deeds').select('id,request_key')
      .eq('wish_id',wishId).eq('request_key',body.requestKey);
    if(error)throw error;
    return {results,rows:deeds.length};
  },raceWishId);
  check('concurrent identical API requests return one Deed and Artifact',
    concurrent.results.every(result=>result.status===200)&&concurrent.rows===1&&
    concurrent.results[0].payload.deedId===concurrent.results[1].payload.deedId&&
    concurrent.results[0].payload.artifactId===concurrent.results[1].payload.artifactId);
  console.log('F04 deterministic local browser continuation: PASS');
}catch(error){
  results.error=String(error);
  console.error(error);
  console.error((await page.locator('body').innerText()).slice(0,2400));
  process.exitCode=1;
}finally{
  writeFileSync(new URL('deterministic-browser-evidence.json',evidence),JSON.stringify(results,null,2)+'\n');
  await browser.close();
}
