import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import {
 FIRST_VALUE_COMPONENTS,FIRST_VALUE_CAPABILITIES,EXPERIENCE_PLANNER_PROMPT,
 validateExperiencePlan,normalizeModelExperiencePlan,conciseModelCopy,focusFirstValueQuestions,validatePlanAnswers,summarizePlanFacts,type ExperiencePlanV1,
} from '../src/experiencePlan.ts';
import {callFirstDeedModel,planFirstValue,prepareDeed,reviewGrounding,signPreparedFirstValue,verifyPreparedFirstValue,validateArtifact,serveFirstDeed} from '../src/firstDeed.ts';

const base={
 version:1,locale:'en',intent:'Find a useful first result',
 firstOutcome:'A private, reusable decision draft',
 deed:{title:'Compose a first useful object',scope:'PRIVATE_DRAFT',result:'An inspectable document prepared in this session'},
 questions:[],components:['jinn_identity','deed_proposal','artifact_reader','source_status','work_receipt','next_deed'],
};
const choice={
 id:'priority',prompt:'Which aspect matters most?',why:'Changes the first result',
 choices:['Option A','Option B'],
};
const valid=(overrides:Record<string,unknown>={}):ExperiencePlanV1=>
 validateExperiencePlan({...base,...overrides});

describe('F03-004 bounded Experience Plan v1',()=>{
 it('uses only generic registered components and a static capability manifest',()=>{
  assert.deepEqual(FIRST_VALUE_CAPABILITIES,['private_draft','local_edit','account_save']);
  assert.equal(FIRST_VALUE_COMPONENTS.includes('artifact_reader'),true);
  assert.ok(!EXPERIENCE_PLANNER_PROMPT.includes('career app'));
  assert.equal(valid().version,1);
  assert.equal(valid().components[0],'jinn_identity');
 });
 it('rejects components, tool scope, duplicates and executable payloads',()=>{
  for(const candidate of [
   {components:[...base.components,'execute_js']},
   {components:[...base.components,'artifact_reader']},
   {deed:{...base.deed,scope:'SEND_EMAIL'}},
   {questions:[choice],components:base.components},
   {questions:Array(4).fill(choice),components:[...base.components,'choice_chips']},
   {questions:[{...choice,id:'Bad ID'}],components:[...base.components,'choice_chips']},
   {components:['artifact_reader',...base.components.slice(1)]},
   {components:base.components.filter(x=>x!=='source_status')},
  ]) assert.throws(()=>validateExperiencePlan({...base,...candidate}),/invalid|Unsupported|Duplicate/i);
 });
 it('preserves only permitted fields and refuses mismatched output locales',()=>{
  const plan=validateExperiencePlan({...base,rogue:'<script>alert(1)</script>'},'en');
  assert.ok(!('rogue' in plan));
  assert.throws(()=>validateExperiencePlan(plan,'ru'),/invalid/);
 });
 it('normalizes typical model formatting without allowing unknown UI components',()=>{
  const response={...base,locale:'ru-RU',version:'1',
    intent:'Подготовить первый полезный результат',
    firstOutcome:'Результат, который можно прочитать и изменить',
    deed:{title:'Подготовить результат',result:'Личный текст'},
    questions:[{id:'вопрос 1',prompt:'Что для Вас важнее?',why:'Это влияет на первый результат',
      choices:['Простой план','Творческое начало']}],
    components:['artifact_reader','source_status','choice_chips','work_receipt',
      'deed_proposal','next_deed','artifact_reader']};
  assert.throws(()=>validateExperiencePlan(response,'ru'));
  const normalized=normalizeModelExperiencePlan(response,'ru');
  assert.equal(normalized.locale,'ru');
  assert.equal(normalized.deed.scope,'PRIVATE_DRAFT');
  assert.equal(normalized.questions[0].id,'q1');
  assert.equal(normalized.components[0],'jinn_identity');
  assert.ok(normalized.components.indexOf('deed_proposal')<normalized.components.indexOf('artifact_reader'));
  assert.deepEqual(normalized.components.filter(x=>x==='artifact_reader'),['artifact_reader']);
  assert.throws(()=>normalizeModelExperiencePlan({...response,
    components:['jinn_identity','execute_js','artifact_reader']},'ru'),/unregistered/);
  assert.throws(()=>normalizeModelExperiencePlan({...response,
    deed:{...response.deed,scope:'SEND_EMAIL'}},'ru'),/scope/);
  assert.throws(()=>normalizeModelExperiencePlan({...response,locale:'en'},'ru'),/locale/);
 });
 it('keeps model-generated UI copy at whole-word or sentence boundaries',()=>{
   const intro='A useful and complete thought. A follow-up clause that should not be severed midword.';
   const clipped=conciseModelCopy(intro,53);
   assert.equal(clipped,'A useful and complete thought.');
   const noSentence=conciseModelCopy('The generated content includes a long additional statement explaining the full intended work',65);
   assert.equal(typeof noSentence,'string');
   assert.ok((noSentence as string).endsWith('…'));
   assert.ok(noSentence==='The generated content includes a long additional statement…' ||
     /[\\s…]$/.test(noSentence as string));
   const russian=conciseModelCopy('Подготовленная полезная концепция включает следующие практические направления и варианты',65);
   assert.equal(typeof russian,'string');
   assert.ok(!(russian as string).endsWith('направ…'));
   assert.ok((russian as string).length<=65);
 });
 it('preserves old V1 plans, but selects one most consequential optional question for first use',async()=>{
   const questions=[choice,{...choice,id:'secondary',prompt:'Which optional aesthetic do you like?'}];
   const components=['jinn_identity','choice_chips',...base.components.slice(1)];
   const old=valid({questions,components});
   assert.equal(old.questions.length,2);
   assert.deepEqual(focusFirstValueQuestions(old).questions.map(q=>q.id),['priority']);
   const proposed=await planFirstValue('Create a useful private object','en','Jinn','',async()=>({
     ...base,questions,components,
   }));
   assert.equal(proposed.questions.length,1);
   assert.equal(proposed.questions[0].id,'priority');
   assert.ok(EXPERIENCE_PLANNER_PROMPT.includes('Before proposing the First Deed'));
   assert.ok(EXPERIENCE_PLANNER_PROMPT.includes('Ask ZERO questions'));
 });
 it('evaluates delivered work against the binding plan promise in the existing grounding review',async()=>{
   const plan=valid({firstOutcome:'A complete fully authored introductory paragraph for immediate use'});
   const artifact=validateArtifact({
     title:'A draft',sections:[{type:'document',title:'Introduction',body:
       'Fill in your name, choose a topic and then write the introductory paragraph. '.repeat(6)}],
     unknowns:[],nextDeed:{title:'Finish writing',why:'The introduction remains unwritten',
       prompt:'Fill in the form'},boundary:'Private only',experience:plan,
   },'');
   let system='';
   const result=await reviewGrounding('I want an introduction','',artifact,async messages=>{
     system=messages[0].content;
     return {safe:false,reason:'promise_unfulfilled'};
   });
   assert.deepEqual(result,{safe:false,reason:'promise_unfulfilled'});
   assert.match(system,/compare artifact.experience.firstOutcome/);
   assert.match(system,/actual substantive text/);
   const incomplete=await reviewGrounding('I want an introduction','',artifact,async()=>({safe:true}));
   assert.deepEqual(incomplete,{safe:false,reason:'promise_unfulfilled'});
   const attested=await reviewGrounding('I want an introduction','',artifact,async()=>({safe:true,promiseFulfilled:true}));
   assert.deepEqual(attested,{safe:true});
 });
 it('revises an unfulfilled First Deed only once and never claims a failed promise is prepared',async()=>{
   const plan=valid({firstOutcome:'A full substantive letter ready for editing'});
   const hollow={
     title:'Letter starter',sections:[{type:'document',title:'Letter',body:
       'First pick a recipient and then write the full message yourself. '.repeat(8)}],
     unknowns:[],nextDeed:{title:'Finish it',why:'Message is missing',prompt:'Write the letter'},
     boundary:'Private only',
   };
   const full={...hollow,title:'A usable first letter',sections:[{type:'document',title:'Letter',
     body:'Hello, I am reaching out to open a thoughtful conversation. '.repeat(8)}]};
   let modelCalls=0,reviewCalls=0;
   const result=await prepareDeed('Help me write a first message','',null,async messages=>{
     modelCalls++;
     if(modelCalls===2)assert.match(messages[0].content,/ONE quality repair/);
     return modelCalls===1?hollow:full;
   },async(_wish,_note,artifact)=>{
     reviewCalls++;
     return artifact.title==='Letter starter'?
       {safe:false,reason:'promise_unfulfilled'}:{safe:true};
   },'en',plan);
   assert.equal(modelCalls,2);
   assert.equal(reviewCalls,2);
   assert.equal(result.receipt.draftSource,'repaired_model');
   assert.equal(result.artifact.sections[0].type,'document');
   let rejectedCalls=0;
   await assert.rejects(prepareDeed('Help me write a first message','',null,async()=>{
     rejectedCalls++;
     return hollow;
   },async()=>({safe:false,reason:'promise_unfulfilled'}),'en',plan),
   {code:'grounding_rejected',status:422});
   assert.equal(rejectedCalls,2);
 });
 it('retries one truncated real-provider JSON response without weakening the schema',async()=>{
  let calls=0;
  const output=await planFirstValue('A normal unseen Wish','en','Jinn','',
    (messages,maxTokens)=>callFirstDeedModel(messages,maxTokens,
      {OPENAI_API_KEY:'dummy-test-key',LLM_PROVIDER:'openai'} as NodeJS.ProcessEnv,
      async()=>{
        calls++;
        return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'length':'stop',
          message:{content:calls===1?'{"version":1,"locale":"en"':JSON.stringify(base)}}]}),
          {status:200,headers:{'Content-Type':'application/json'}});
      },1000));
  assert.equal(calls,2);
  assert.equal(output.version,1);
 });
 it('retries DeepSeek JSON mode whitespace-only content once',async()=>{
  let calls=0;
  const output=await planFirstValue('An unrelated Wish','en','Jinn','',
    (messages,maxTokens)=>callFirstDeedModel(messages,maxTokens,
      {DEEPSEEK_API_KEY:'dummy-test-key',LLM_PROVIDER:'deepseek'} as NodeJS.ProcessEnv,
      async()=>{
        calls++;
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',
          message:{content:calls===1?'    ':JSON.stringify(base)}}]}),
          {status:200,headers:{'Content-Type':'application/json'}});
      },1000));
  assert.equal(calls,2);
  assert.equal(output.version,1);
 });
 it('offers at most three optional, consequential questions and safely validates answers',()=>{
  const plan=valid({questions:[choice],components:['jinn_identity','choice_chips',...base.components.slice(1)]});
  assert.deepEqual(validatePlanAnswers(plan,{priority:'Option A'}),{priority:'Option A'});
  assert.deepEqual(validatePlanAnswers(plan,{priority:'  My own answer  '}),{priority:'My own answer'});
  assert.deepEqual(validatePlanAnswers(plan,{priority:'__unsure__'}),{});
  assert.deepEqual(validatePlanAnswers(plan,{priority:'__skip__'}),{});
  assert.throws(()=>validatePlanAnswers(plan,{notListed:'Answer'}),/Unsupported/);
  assert.equal(summarizePlanFacts(plan,{priority:'Option A'}),'Which aspect matters most?: Option A');
 });
 it('plans different arrangements using one model call and locale, without topic routing',async()=>{
  const contexts:string[]=[];
  const wishes=[
   'I want to write stories about my life',
   'I want to change the work I do',
   'I want to become a frog',
  ];
  for(const [i,wish] of wishes.entries()){
   const layout=i===1?['jinn_identity','deed_proposal','artifact_reader','next_deed','source_status','work_receipt']:
     i===2?['jinn_identity','choice_chips','deed_proposal','artifact_reader','supporting_section','source_status','work_receipt','next_deed']:
     base.components;
   const p=await planFirstValue(wish,'en','Maya','A user-written note',
     async messages=>{
      contexts.push(messages[1].content);
      return {...base,intent:'User wants a helpful start for '+i,
        firstOutcome:'A distinct usable output '+i,
        ...(i===2?{questions:[choice]}:{}),components:layout};
     });
   assert.equal(p.firstOutcome,'A distinct usable output '+i);
   assert.deepEqual(p.components,layout);
  }
  assert.equal(contexts.length,3);
  assert.ok(contexts.every(x=>x.includes('"jinnName":"Maya"')&&x.includes('"priorWishData":null')));
 });
 it('fails before paid model generation when local First-Value signing is not configured',async()=>{
  const original=process.env.SUPABASE_SERVICE_ROLE_KEY;
  try{
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response=await serveFirstDeed(new Request('http://localhost/api/first-deed',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({mode:'prepare',wish:'Start a first useful document',locale:'en',
        plan:base,answers:{}}),
    }));
    const body=await response.json();
    assert.equal(response.status,503);
    assert.equal(body.code,'save_not_configured');
  }finally{
    if(original===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=original;
  }
 });
 it('rejects an invalid plan after one bounded repair rather than displaying generic tips',async()=>{
  let calls=0;
  await assert.rejects(planFirstValue('Any Wish','fr','Jinn','',async()=>{
   calls++;return {...base,locale:'fr',deed:{...base.deed,scope:'EXTERNAL_RUN'}};
  }),{code:'experience_plan_invalid',status:422});
  assert.equal(calls,2);
 });
 it('generates substantial user-inspectable First Artifacts and preserves plan, source, receipt',async()=>{
  const plan=valid({questions:[choice],components:['jinn_identity','choice_chips',...base.components.slice(1)]});
  const body='A tangible draft the person can actually use. '.repeat(10);
  let captured='';
  const response=await prepareDeed('I want a useful start','',null,async messages=>{
   captured=messages[1].content;
   return {
    language:'en',title:'A concrete starting document',
    sections:[{type:'document',title:'Prepared content',body},
      {type:'questions',title:'Optional next decisions',items:['What would you change?']}],
    unknowns:['A fact not yet provided'],
    nextDeed:{title:'Continue with one correction',why:'It makes the draft more accurate',prompt:'Add a known detail'},
    boundary:'Private AI draft only; no outside actions.',
   };
  },async()=>({safe:true}), 'en',plan,{priority:'Option A'});
  assert.equal(response.artifact.experience?.version,1);
  assert.equal(response.artifact.sourceNote,'Which aspect matters most?: Option A');
  assert.match(captured,/A distinct|A private, reusable decision draft/);
  assert.equal(response.receipt.status,'PREPARED');
  assert.equal(response.receipt.draftSource,'model');
  assert.match(response.receipt.scope,/No external action/);
  assert.equal(validateArtifact(response.artifact,response.artifact.sourceNote).experience?.deed.scope,'PRIVATE_DRAFT');
 });
 it('prevents forged initial receipt, Wish, artifact and expired preparation proof',async()=>{
  const env={SUPABASE_SERVICE_ROLE_KEY:'local-test-only-signing-key-'.repeat(3)} as NodeJS.ProcessEnv;
  const plan=valid();
  const artifact=validateArtifact({
    title:'First result',sections:[{type:'document',title:'Prepared section',
      body:'Meaningful text that is ready to use. '.repeat(12)}],
    unknowns:[],boundary:'Only a private draft.',
    nextDeed:{title:'Refine',why:'Improve one detail',prompt:'Add a fact'},
    experience:plan,
  },'');
  const receipt={status:'PREPARED' as const,operation:'AI composed a private first artifact',
    recordedAt:'2026-11-16T03:00:00Z',scope:'Private draft only; no external action.',
    draftSource:'model' as const};
  const now=Date.now();
  const proof=signPreparedFirstValue('A Wish',artifact,receipt,env,now+60000);
  assert.doesNotThrow(()=>verifyPreparedFirstValue('A Wish',artifact,receipt,proof,env,now));
  assert.throws(()=>verifyPreparedFirstValue('Different Wish',artifact,receipt,proof,env,now),
    {code:'invalid_preparation'});
  assert.throws(()=>verifyPreparedFirstValue('A Wish',{...artifact,title:'Forged result'},receipt,proof,env,now),
    {code:'invalid_preparation'});
  assert.throws(()=>verifyPreparedFirstValue('A Wish',artifact,{...receipt,status:'SENT' as never},proof,env,now),
    {code:'invalid_preparation'});
  assert.throws(()=>verifyPreparedFirstValue('A Wish',artifact,receipt,proof,env,now+120000),
    {code:'expired_preparation'});
 });
 it('refuses hollow worksheets in first-value mode but retains existing saved data on failure',async()=>{
  const plan=valid();let calls=0;
  await assert.rejects(prepareDeed('A new wish','',null,async()=>{
   calls++;return {title:'Empty advice',sections:[{type:'document',title:'Tips',body:'Try your best.'}],
    unknowns:[],nextDeed:{title:'Do something',why:'Maybe useful',prompt:'Start'},boundary:'Draft only'};
  },async()=>({safe:true}),'en',plan),{status:422});
  assert.equal(calls,2);
 });
});
