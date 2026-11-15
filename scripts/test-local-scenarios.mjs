import { chromium } from 'playwright-core';
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
const dir=new URL('../docs/evidence/f03/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const cases=[
 {name:'garden',wish:'I want to start a neighborhood garden on a vacant lot, but I do not know who owns it',title:'Garden permission starter kit',source:'Owner unknown',section:'Land-use checklist',body:'Identify who controls the lot before asking for permission.'},
 {name:'unexpected',wish:'I want to repair an old clock that stopped working',title:'Clock observation starter kit',source:'No detail supplied',section:'Condition log',body:'Record what you can see without opening or damaging the clock.'}
];
let active=cases[0];
await page.route('**/api/first-deed',route=>{
 const request=route.request().postDataJSON();
 if(request.mode==='clarify')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({question:null})});
 const artifact={title:active.title,sourceNote:request.answer||active.source,sections:[{type:'document',title:active.section,body:active.body},{type:'questions',title:'Questions to resolve',items:['What do you know already?','What remains uncertain?']}],unknowns:['Permission or condition is not verified.'],nextDeed:{title:'Record one fact',why:'It guides the next safe step.',prompt:'Add an observation in your own words.'},boundary:'Private preparation only. No external action was taken.'};
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({artifact,receipt:{status:'PREPARED',operation:'AI generated and checked an editable draft against supplied facts',recordedAt:new Date().toISOString(),scope:'Private draft only.'}})});
});
try{for(const item of cases){active=item;await page.goto(base);await page.locator('#wish').fill(item.wish);await page.getByRole('button',{name:/Continue with Jinn/}).click();await page.getByRole('button',{name:/Prepare my first deed/}).click();await page.getByText(item.title).first().waitFor();await page.screenshot({path:`${dir}/${item.name}-desktop.png`,fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${dir}/${item.name}-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:900});console.log(item.name,'generic workspace PASS');}}
finally{await context.close();await browser.close();}
