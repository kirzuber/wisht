// Manual REAL configured model integration evaluation. No model stubs.
// Requires local API running against the configured DeepSeek/OpenAI provider.
// This script never sends credentials to the browser or creates saved Wishes.
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

if(process.env.JINN_TEST_MODE==='1'||process.env.JINN_LOCAL_MODEL_ENDPOINT)
  throw new Error('Refusing real-model evaluation: a local AI fixture is enabled.');
const url=process.env.JINN_EVAL_API_URL||'http://127.0.0.1:3001/api/first-deed';
if(!/^http:\/\/127\.0\.0\.1:3001\/api\/first-deed$/.test(url))
  throw new Error('Only the locally configured API is accepted; never submit evaluation Wishes to hosted production.');
const samples=[
 {locale:'en',wish:'I want to write a book about my life'},
 {locale:'en',wish:'I want to change my career but have no resume ready'},
 {locale:'en',wish:'I want to become a frog'},
 {locale:'ru',wish:'Я хочу написать книгу семейных историй'},
];
// These are published smoke cases from the designer brief, never the future blind Wish.
const hashes=Object.fromEntries(['api/src/experiencePlan.ts','api/src/firstDeed.ts',
 'web/src/FirstValueExperience.tsx'].map(path=>
  [path,createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
const evidence={kind:'F03-004 configured-live-model evaluation',kindOfInput:'published-smoke-not-blind',
 locales:['en','ru'],recordedAt:new Date().toISOString(),sourceHashes:hashes,
 evidence:[],limitations:['No real-world external action is available','Human emotional reaction is not measured',
  'Real-world facts are not independently verified','Model token cost is not returned by this API wrapper']};
const request=async (body,locale)=>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),70000);
 const started=performance.now();
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
   signal:controller.signal,body:JSON.stringify({...body,locale})});
  const data=await response.json().catch(()=>null);
  return {status:response.status,ms:Math.round(performance.now()-started),data};
 }finally{clearTimeout(timeout);}
};
let failures=0;
for(const {wish,locale} of samples){
 const item={wish,locale,plan:null,selectedAnswers:{},artifact:null,receipt:null,
  planningLatencyMs:null,preparationLatencyMs:null,error:null};
 try{
  const planned=await request({mode:'plan',wish,jinnName:'Jinn'},locale);
  item.planningLatencyMs=planned.ms;
  if(planned.status!==200||!planned.data?.plan)throw Error('Plan failed: HTTP '+planned.status+' / '+(planned.data?.code||'invalid'));
  item.plan=planned.data.plan;
  // Skip every optional question to test sparse-input quality without fabricated facts.
  item.selectedAnswers=Object.fromEntries(item.plan.questions.map(q=>[q.id,'__skip__']));
  const prepared=await request({mode:'prepare',wish,plan:item.plan,answers:item.selectedAnswers},locale);
  item.preparationLatencyMs=prepared.ms;
  if(prepared.status!==200||!prepared.data?.artifact)throw Error('First Artifact failed: HTTP '+prepared.status+' / '+(prepared.data?.code||'invalid'));
  const {artifact,receipt,proof}=prepared.data;
  item.artifact=artifact;item.receipt=receipt;
  item.hasVerifiedSaveProof=typeof proof==='string'&&proof.length>40;
  item.documentCharacters=artifact.sections.filter(s=>s.type==='document').reduce((n,s)=>n+s.body.length,0);
  item.sectionTypes=artifact.sections.map(s=>s.type);
  item.questionCount=item.plan.questions.length;
  item.qualityChecks={
   substantial:item.documentCharacters>=260,
   noWorksheet:receipt.draftSource!=='worksheet',
   preparedNotSaved:receipt.status==='PREPARED',
   noExternalClaim:/No external action|Private draft|private/i.test(receipt.scope),
   validatedPlanVersion:artifact.experience?.version===1,
  };
  if(Object.values(item.qualityChecks).some(x=>!x))failures++;
 }catch(error){item.error=error instanceof Error?error.message:String(error);failures++;}
 evidence.evidence.push(item);
 console.log(JSON.stringify({wish:item.wish,questions:item.questionCount,
  sections:item.sectionTypes,characters:item.documentCharacters,
  planMs:item.planningLatencyMs,draftMs:item.preparationLatencyMs,
  receipt:item.receipt?.status,error:item.error}));
}
const dir=new URL('../docs/evidence/f03-004/',import.meta.url);
mkdirSync(dir,{recursive:true});
const outfile=new URL('configured-real-model-evaluation.json',dir);
writeFileSync(outfile,JSON.stringify(evidence,null,2)+'\n');
console.log('Wrote evidence: '+outfile.pathname);
if(failures)process.exitCode=1;
