import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import {
 FIRST_VALUE_COMPONENTS,FIRST_VALUE_CAPABILITIES,EXPERIENCE_PLANNER_PROMPT,
 validateExperiencePlan,validatePlanAnswers,summarizePlanFacts,type ExperiencePlanV1,
} from '../src/experiencePlan.ts';
import {planFirstValue,prepareDeed,validateArtifact} from '../src/firstDeed.ts';

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
 it('refuses hollow worksheets in first-value mode but retains existing saved data on failure',async()=>{
  const plan=valid();let calls=0;
  await assert.rejects(prepareDeed('A new wish','',null,async()=>{
   calls++;return {title:'Empty advice',sections:[{type:'document',title:'Tips',body:'Try your best.'}],
    unknowns:[],nextDeed:{title:'Do something',why:'Maybe useful',prompt:'Start'},boundary:'Draft only'};
  },async()=>({safe:true}),'en',plan),{status:422});
  assert.equal(calls,2);
 });
});
