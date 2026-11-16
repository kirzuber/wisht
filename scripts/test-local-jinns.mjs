// F03-003 browser acceptance: real LOCAL Supabase Auth/DB, deterministic AI fixtures.
// Refuses hosted Supabase. Run after local migration up + npm run dev.
// This script intentionally creates disposable local Auth users and database rows.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';

const base = process.env.F03_WEB_URL || 'http://127.0.0.1:5173/';
const bundle = await (await fetch(new URL('/src/supabaseClient.ts',base))).text();
if (!bundle.includes('http://127.0.0.1:54321'))
  throw new Error('Refusing F03-003 browser test: Vite must target LOCAL Supabase.');
const chrome = process.env.CHROME_PATH || [
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome','/usr/bin/chromium',
].find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to the local Chrome executable.');
const browser = await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage();
const dir = new URL('../docs/evidence/f03-003/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));

const localInbox = 'http://127.0.0.1:54324';
const listMail = async () => (await (await fetch(localInbox+'/api/v1/messages')).json()).messages || [];
const signIn = async email => {
  let prior = new Set((await listMail()).map(message=>message.ID));
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#auth-email').fill(email);
  await page.getByRole('button',{name:/Send a sign-in code/}).click();
  let code = null;
  for (let attempt=0;attempt<35;attempt++){
    const message=(await listMail()).find(item=>!prior.has(item.ID) && item.To?.some(to=>to.Address===email));
    if (message){
      const detail=await (await fetch(localInbox+'/api/v1/message/'+message.ID)).json();
      code=(detail.HTML||detail.Text||'').match(/\b(\d{6})\b/)?.[1];
      if(code)break;
    }
    await wait(300);
  }
  if(!code)throw new Error('Local Mailpit OTP not received');
  await page.locator('#auth-code').fill(code);
  await page.getByRole('button',{name:/Verify and continue/}).click();
  await page.getByRole('heading',{name:'My Jinns.'}).waitFor();
};
await page.route('**/api/first-deed',route=>{
  const data=route.request().postDataJSON();
  if (data.mode==='clarify')return route.fulfill({status:200,json:{question:null}});
  const isFollowUp=data.mode==='continue';
  const note=isFollowUp?'Aunt confirmed one memory':(data.answer || '');
  return route.fulfill({status:200,json:{
    artifact:{
      title:isFollowUp?'Follow-up kit':'Starter kit for this Wish',
      sourceNote:isFollowUp?'Source remains with this Wish':note,
      sections:[{type:'document',title:'Starting notes',body:'Keep facts with this Wish only.'}],
      unknowns:['One unanswered question'],
      nextDeed:{title:'Record a detail',why:'To make progress',prompt:'Write only what you know'},
      boundary:'Private draft only. No external action was performed.',
    },
    receipt:{status:'PREPARED',operation:isFollowUp
      ?'AI prepared a follow-up draft from the saved, corrected artifact'
      :'AI generated and checked an editable draft against supplied facts',
      recordedAt:new Date().toISOString(),scope:'Private draft only.'},
  }});
});
const choose = async name => {
  await page.getByRole('button',{name:'My Jinns',exact:true}).click().catch(()=>{});
  await page.locator('.jinn-choice').filter({hasText:name}).click();
  await page.getByRole('heading',{name:name,exact:true}).last().waitFor();
};
const create = async (name,purpose='') => {
  await page.getByRole('button',{name:'Create Jinn',exact:true}).first().click();
  await page.locator('#jinn-name').fill(name);
  await page.locator('#jinn-purpose').fill(purpose);
  await page.getByRole('button',{name:'Create Jinn',exact:true}).last().click();
  await page.locator('.jinn-workspace-identity h3').getByText(name).waitFor();
};
const startWish = async (jinnName,aspiration) => {
  await choose(jinnName);
  await page.getByRole('button',{name:new RegExp('Start a Wish with '+jinnName)}).click();
  await page.locator('#home-jinn-choice').waitFor();
  assert.match(await page.locator('#home-jinn-choice option:checked').innerText(),new RegExp(jinnName));
  assert.match(await page.locator('.welcome-lead').innerText(),new RegExp(jinnName));
  await page.locator('#wish').fill(aspiration);
  await page.getByRole('button',{name:'Continue with '+jinnName}).click();
  await page.getByRole('button',{name:/Prepare my first deed/}).waitFor();
  assert.equal(await page.locator('.first-jinn strong').innerText(),jinnName);
  await page.getByRole('button',{name:/Prepare my first deed/}).click();
  await page.getByText('Your first Deed.',{exact:true}).waitFor();
  await page.locator('#first-jinn-choice').waitFor();
  assert.equal(await page.locator('#first-jinn-choice option:checked').innerText(),jinnName);
  await page.getByRole('button',{name:/Keep this wish/}).click();
  await page.getByText('Continue your wish.',{exact:true}).waitFor();
  assert.equal(await page.locator('.first-jinn strong').innerText(),jinnName);
  await page.getByRole('button',{name:'My Jinns',exact:true}).click();
};
try{
  const email='f03-003-local-'+Date.now()+'@example.test';
  await page.goto(base);
  // Guest stays Wish-first; no Jinn selector or sign-in prerequisite.
  await page.getByRole('button',{name:'Continue with Jinn'}).waitFor();
  assert.equal(await page.locator('#home-jinn-choice').count(),0);
  await page.screenshot({path:dir+'/home-guest-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dir+'/home-guest-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await signIn(email);
  // Merely materializing a system-default Jinn is not user onboarding.
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.getByRole('button',{name:'Continue with Jinn'}).waitFor();
  assert.equal(await page.locator('.home-jinn-context').count(),0);
  await page.screenshot({path:dir+'/home-fresh-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dir+'/home-fresh-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'My Jinns'}).click();
  // Default Jinn is materialized for an existing/new signed-in account.
  await page.locator('.jinn-choice').filter({hasText:'Default Jinn · 0 Wishes'}).waitFor();
  await page.getByRole('button',{name:'Edit Jinn'}).click();
  await page.locator('#jinn-name').fill('Everyday Jinn');
  await page.getByRole('button',{name:'Save Jinn'}).click();
  await page.getByRole('heading',{name:'Everyday Jinn',exact:true}).waitFor();
  // Exactly one deliberately named Jinn is shown at the first screen.
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.getByRole('button',{name:'Continue with Everyday Jinn'}).waitFor();
  assert.equal(await page.locator('#home-jinn-choice').count(),0);
  await page.screenshot({path:dir+'/home-named-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dir+'/home-named-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'My Jinns'}).click();

  await create('Writing Jinn','Family book and stories');
  await create('Exploring Jinn','Curiosity projects');
  assert.match(await page.locator('.jinn-workspace').innerText(),/No Wishes with Exploring Jinn yet/);
  await create('Temporary Jinn');
  // Multi-Jinn home must show a chooser and honor explicit selection.
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.locator('#home-jinn-choice').waitFor();
  assert.equal(await page.locator('#home-jinn-choice option').count(),4);
  await page.locator('#home-jinn-choice').selectOption({label:'Writing Jinn'});
  await page.getByRole('button',{name:'Continue with Writing Jinn'}).waitFor();
  await page.screenshot({path:dir+'/home-multiple-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dir+'/home-multiple-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.reload();
  await page.locator('#home-jinn-choice').waitFor();
  assert.match(await page.locator('#home-jinn-choice option:checked').innerText(),/Writing Jinn/);
  await page.locator('#home-jinn-choice').selectOption({label:'Temporary Jinn'});
  await page.getByRole('button',{name:'My Jinns'}).click();
  await choose('Temporary Jinn');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete empty Jinn'}).click();
  await page.locator('.jinn-choice').filter({hasText:'Temporary Jinn'}).waitFor({state:'detached'});
  // A deleted explicitly selected companion must not silently become primary.
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.getByText('previously selected Jinn is no longer available',{exact:false}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Continue with Everyday Jinn'}).count(),0);
  await page.getByRole('button',{name:'Choose my default Jinn'}).click();
  await page.locator('#home-jinn-choice').waitFor();
  assert.match(await page.locator('#home-jinn-choice option:checked').innerText(),/Everyday Jinn/);
  await page.getByRole('button',{name:'My Jinns'}).click();

  const goals=[
    'Compose a family story book',
    'Learn basic photography',
    'Try community gardening',
    'Practice a new language',
  ];
  for(const goal of goals) await startWish('Writing Jinn',goal);
  // Explicitly save a NEW Wish to a different owned Jinn, not just by moving one.
  await startWish('Exploring Jinn','Restore an old clock safely');
  // Changing the homepage selector must also persist real assignment.
  await page.getByRole('button',{name:'Jinn home'}).click();
  await page.locator('#home-jinn-choice').selectOption({label:'Everyday Jinn'});
  await page.locator('#wish').fill('Observe birds near the lake');
  await page.getByRole('button',{name:'Continue with Everyday Jinn'}).click();
  await page.getByRole('button',{name:/Prepare my first deed/}).waitFor();
  assert.equal(await page.locator('.first-jinn strong').innerText(),'Everyday Jinn');
  await page.getByRole('button',{name:/Prepare my first deed/}).click();
  await page.getByRole('button',{name:/Keep this wish/}).click();
  await page.getByText('Continue your wish.',{exact:true}).waitFor();
  assert.equal(await page.locator('.first-jinn strong').innerText(),'Everyday Jinn');
  await page.getByRole('button',{name:'My Jinns'}).click();
  await choose('Everyday Jinn');
  assert.equal(await page.locator('.my-work-card').filter({hasText:'Observe birds near the lake'}).count(),1);
  await choose('Writing Jinn');
  assert.equal(await page.locator('.my-work-card').count(),4);
  await page.screenshot({path:dir+'/my-jinns-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dir+'/my-jinns-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});

  const card = page.locator('.my-work-card').filter({hasText:goals[0]});
  await card.locator('.my-work-card-main').click();
  await page.locator('#first-source-note').fill('Aunt confirmed one memory');
  await page.locator('#first-source-note').blur();
  await page.getByRole('button',{name:'Save corrections'}).click();
  await page.getByRole('button',{name:'Corrections saved'}).waitFor();
  await page.getByRole('button',{name:'Prepare next Deed'}).click();
  await page.getByText('Earlier Deeds',{exact:false}).waitFor();
  await page.getByRole('button',{name:'My Jinns',exact:true}).click();
  await choose('Writing Jinn');

  const moveCard=page.locator('.my-work-card').filter({hasText:goals[0]});
  await moveCard.locator('select').selectOption({label:'Exploring Jinn'});
  await page.getByText('Your saved work stays with the Wish.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Confirm move'}).click();
  await page.locator('.jinn-workspace-identity h3').getByText('Exploring Jinn').waitFor();
  assert.equal(await page.locator('.my-work-card').count(),2);
  await page.getByRole('button',{name:new RegExp(goals[0])}).first().click();
  await page.locator('#first-source-note').waitFor();
  assert.equal(await page.locator('#first-source-note').inputValue(),'Aunt confirmed one memory');
  await page.getByText('Earlier Deeds',{exact:false}).waitFor();
  assert.equal(await page.locator('.first-jinn strong').innerText(),'Exploring Jinn');
  const savedUrl=page.url();
  await page.reload();
  await page.locator('#first-source-note').waitFor();
  assert.equal(await page.locator('.first-jinn strong').innerText(),'Exploring Jinn');
  assert.equal(await page.locator('#first-source-note').inputValue(),'Aunt confirmed one memory');
  await page.screenshot({path:dir+'/moved-wish-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:dir+'/moved-wish-mobile.png',fullPage:true});

  await page.getByRole('button',{name:'Sign out'}).click();
  await page.goto(savedUrl);
  await page.locator('#auth-email').waitFor();
  // Second account must not inherit the first account's Jinns or Wishes.
  const secondEmail='f03-003-isolated-'+Date.now()+'@example.test';
  await page.getByRole('button',{name:'Cancel'}).click();
  await signIn(secondEmail);
  assert.equal(await page.locator('.jinn-choice').count(),1);
  assert.equal(await page.getByText(goals[0]).count(),0);
  console.log('PASS: local Auth/DB multi-Jinn creation, four Wishes, correction+history preservation on move, reload, mobile and owner isolation');
}catch(error){
  console.error(error); console.error((await page.locator('body').innerText()).slice(0,3500));throw error;
}finally{await context.close();await browser.close();}
