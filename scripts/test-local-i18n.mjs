// Browser acceptance for EN/RU/FR/ES. Deterministic model response, real Vite UI.
// No hosted access, no accounts, no paid API calls; tests locale propagation and safe state.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';

const base=process.env.F03_WEB_URL||'http://127.0.0.1:5173/';
const bundle=await (await fetch(new URL('/src/supabaseClient.ts',base))).text();
if(!bundle.includes('http://127.0.0.1:54321')) throw Error('Refusing i18n browser test against nonlocal Supabase.');
const chrome=process.env.CHROME_PATH || [
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome','/usr/bin/chromium',
].find(existsSync);
if(!chrome)throw Error('Set CHROME_PATH to a browser binary.');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const dir=new URL('../docs/evidence/i18n/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const scenarios=[
 {locale:'en',heading:'What would you like to do?',next:'Continue with Jinn',prepare:'Prepare my first deed',
  title:'A first step for your book',deedHeading:'Your first Deed.',keep:'Keep this wish',email:'YOUR EMAIL',marker:'YOUR WORDS'},
 {locale:'ru',heading:'Что бы вы хотели сделать?',next:'Продолжить с Jinn',prepare:'Подготовить первый шаг',
  title:'Первый шаг для книги',deedHeading:'Ваш первый шаг.',keep:'Сохранить желание',email:'ВАША ПОЧТА',marker:'ВАШИ СЛОВА'},
 {locale:'fr',heading:'Que souhaitez-vous faire ?',next:'Continuer avec Jinn',prepare:'Préparer mon premier acte',
  title:'Un premier pas pour votre livre',deedHeading:'Votre premier acte.',keep:'Conserver ce souhait',email:'VOTRE ADRESSE E-MAIL',marker:'VOS MOTS'},
 {locale:'es',heading:'¿Qué te gustaría hacer?',next:'Continuar con Jinn',prepare:'Preparar mi primera acción',
  title:'Primer paso para tu libro',deedHeading:'Tu primera acción.',keep:'Guardar este deseo',email:'TU CORREO',marker:'TUS PALABRAS'},
];
const original='I want to make a book about trees';
const localizedDrafts={
 en:{body:'Editable draft based on your facts',unknown:'Unknown detail',why:'One reason',prompt:'One next step',boundary:'Private draft. Nothing sent.'},
 ru:{body:'Черновик на основе ваших сведений',unknown:'Неизвестная деталь',why:'Одна причина',prompt:'Один следующий шаг',boundary:'Личный черновик. Ничего не отправлено.'},
 fr:{body:'Brouillon modifiable basé sur vos informations',unknown:'Détail inconnu',why:'Une raison',prompt:'Une prochaine étape',boundary:'Brouillon privé. Rien n’a été envoyé.'},
 es:{body:'Borrador editable basado en tus datos',unknown:'Detalle desconocido',why:'Un motivo',prompt:'Un siguiente paso',boundary:'Borrador privado. No se ha enviado nada.'},
};
try{
 for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width:1280,height:850},locale:'en-US'});
  const page=await context.newPage();
  const requests=[];
  const localized=localizedDrafts[scenario.locale];
  await page.route('**/api/first-deed',route=>{
   const data=route.request().postDataJSON();
   requests.push(data);
   if(data.mode==='clarify')return route.fulfill({status:200,json:{question:null}});
   return route.fulfill({status:200,json:{
     artifact:{
       title:scenario.title,sourceNote:data.answer||'',
       sections:[{type:'document',title:scenario.title,body:localized.body}],
       unknowns:[localized.unknown],
       nextDeed:{title:scenario.title,why:localized.why,prompt:localized.prompt},
       boundary:localized.boundary,
     },
     receipt:{status:'PREPARED',draftSource:'model',
       operation:'AI generated and checked an editable draft against supplied facts',
       recordedAt:'2026-11-15T23:00:00.000Z',scope:'Private draft only.'},
   }});
  });
  await page.goto(base);
  await page.locator('#ui-language').selectOption(scenario.locale);
  assert.equal(await page.locator('html').getAttribute('lang'),scenario.locale);
  assert.equal((await page.locator('.welcome h1').innerText()).replace(/\s+/g,' ').trim(),scenario.heading);
  await page.locator('#wish').fill(original);
  await page.getByRole('button',{name:scenario.next}).click();
  await page.getByRole('button',{name:scenario.prepare}).click();
  await page.getByRole('heading',{name:scenario.deedHeading}).waitFor();
  assert.equal(await page.locator('.first-wish h1').innerText(),original,'Do not silently translate the original Wish');
  assert.equal(await page.locator('.first-canvas h2').innerText(),scenario.title);
  const cssMarker=await page.locator('.first-source').evaluate(element=>getComputedStyle(element,'::before').content);
  assert.ok(cssMarker.includes(scenario.marker),'CSS-generated artifact labels must follow the locale');
  assert.ok(requests.some(item=>item.mode==='clarify')&&requests.some(item=>item.mode==='prepare'));
  assert.ok(requests.every(item=>item.locale===scenario.locale),
    'Every draft-related request must carry the explicit chosen locale');
  const beforeSwitch=requests.length;
  await page.screenshot({path:`${dir}/${scenario.locale}-deed-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${dir}/${scenario.locale}-deed-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:850});
  await page.locator('#ui-language').selectOption('en');
  await page.getByRole('heading',{name:'Your first Deed.'}).waitFor();
  assert.equal(await page.locator('.first-canvas h2').innerText(),scenario.title,
    'Changing UI language must not silently translate or overwrite user Artifacts');
  assert.equal(requests.length,beforeSwitch,'UI language change must not trigger a new paid model request');
  await page.locator('#ui-language').selectOption(scenario.locale);
  await page.getByRole('button',{name:scenario.keep}).click();
  await page.getByText(scenario.email,{exact:true}).waitFor();
  assert.equal(requests.length,beforeSwitch,'OTP gate must not trigger a new model request');
  await page.goto(base);
  assert.equal(await page.locator('#ui-language').inputValue(),scenario.locale,
    'Manual language choice must persist across page reload');
  assert.equal(await page.locator('html').getAttribute('lang'),scenario.locale);
  await context.close();
 }
 console.log('PASS: EN/RU/FR/ES interface, explicit API locale, preserved Wish/Artifact, OTP and persistence, desktop/mobile');
}finally{await browser.close();}
