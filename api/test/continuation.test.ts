import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {planFirstValue,prepareDeed,serveFirstDeed} from '../src/firstDeed.ts';
import {validateExperiencePlan} from '../src/experiencePlan.ts';
import {approvedActionFingerprint,assertReplayBinding,ContinuationError} from '../src/continuation.ts';

const plan=validateExperiencePlan({version:1,locale:'en',intent:'Continue one saved Wish',
  firstOutcome:'A fully written new private chapter opening',
  deed:{title:'Write a chapter opening',scope:'PRIVATE_DRAFT',result:'A complete chapter opening'},
  questions:[],components:['jinn_identity','deed_proposal','artifact_reader','source_status','work_receipt','next_deed']});
const chapter={title:'Chapter opening',sections:[{type:'document',title:'Opening',
  body:'Sunday pancakes with Aunt. This is a private opening based on the confirmed detail. '.repeat(5)}],
  unknowns:['Other events remain unknown'],
  nextDeed:{title:'Explore another confirmed memory',why:'Advance the chapter without guessing',
    prompt:'Choose a detail you know'},boundary:'Private draft. Nothing sent or verified.'};

describe('F04 trusted continuation boundaries',()=>{
  it('binds a request key to approved action and source, context and Jinn versions',()=>{
    const env={SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40)};
    const version={sourceId:'00000000-0000-4000-8000-000000000001',sourceVersion:1,
      contextRevision:2,actorId:'00000000-0000-4000-8000-000000000002',
      actorName:'Original Jinn',actorVersion:'2026-11-20T12:00:00Z',
      latestDeedId:'00000000-0000-4000-8000-000000000003'};
    const fingerprint=approvedActionFingerprint('owner','wish',plan,version,'',env);
    assert.match(fingerprint,/^[0-9a-f]{64}$/);
    assert.equal(fingerprint,approvedActionFingerprint('owner','wish',plan,version,'',env));
    assert.notEqual(fingerprint,approvedActionFingerprint('owner','wish',plan,version,'different edit',env));
    for(const change of [{sourceVersion:2},{contextRevision:3},
      {actorId:'00000000-0000-4000-8000-000000000004'},
      {actorName:'Renamed Jinn'},{actorVersion:'2026-11-20T12:01:00Z'},
      {latestDeedId:'00000000-0000-4000-8000-000000000005'}])
      assert.notEqual(fingerprint,approvedActionFingerprint('owner','wish',plan,{...version,...change},'',env));
    assert.doesNotThrow(()=>assertReplayBinding({wish_id:'wish',request_fingerprint:fingerprint},'wish',fingerprint));
    assert.throws(()=>assertReplayBinding({wish_id:'wish',request_fingerprint:fingerprint},'wish','f'.repeat(64)),
      (error:unknown)=>error instanceof ContinuationError&&error.status===409&&error.code==='request_conflict');
    assert.throws(()=>assertReplayBinding({wish_id:'wish',request_fingerprint:null},'wish',fingerprint),
      (error:unknown)=>error instanceof ContinuationError&&error.status===409);
  });
  it('plans from confirmed context and labels earlier AI work as a draft',async()=>{
    const calls:Array<{system:string;user:string}>=[];
    const evidence={confirmedUserContext:{sourceNote:'Sunday pancakes with Aunt',
      confirmedFacts:[],unknowns:[]},priorAiDraft:{title:'Book starter',excerpt:'Suggested structure'}};
    const candidate={intent:'Continue the story',firstOutcome:'A complete new chapter opening',
      deed:{title:'Write the opening',result:'An authored private opening'},questions:[]};
    const result=await planFirstValue('Write my life story','en','Jinn','',async messages=>{
      calls.push({system:messages[0].content,user:messages[1].content});
      return messages[0].content.includes('PLAN_FEASIBILITY_GATE')?
        {feasible:true,reason:'none'}:candidate;
    },evidence);
    assert.equal(result.deed.scope,'PRIVATE_DRAFT');
    assert.match(calls[0].system,/continuation.*NEW substantive result/i);
    assert.match(calls[0].user,/priorAiDraft/);
    assert.match(calls[1].system,/previous AI Artifact as a draft/);
  });
  it('uses only current approved Aunt context and keeps prior work labeled',async()=>{
    let generationPrompt='';let reviewNote='';
    const result=await prepareDeed('Write my life story','Sunday pancakes with Aunt',null,
      async messages=>{generationPrompt=messages[1].content;return chapter;},
      async(_wish,note)=>{reviewNote=note;return {safe:true};},'en',plan,{},
      {confirmedFacts:['I dropped the last pancake'],unknowns:['Other dates unknown'],
        priorDraft:{title:'Book starter',excerpt:'A draft structure, not evidence',
          nextDeedTitle:'Make a chapter opening'}});
    assert.equal(result.artifact.sourceNote,'Sunday pancakes with Aunt');
    assert.match(generationPrompt,/CONFIRMED USER CLAIMS/);
    assert.match(generationPrompt,/PRIOR AI-AUTHORED DRAFT.*NOT personal evidence/);
    assert.match(generationPrompt,/I dropped the last pancake/);
    assert.doesNotMatch(generationPrompt,/Grandma/);
    assert.match(reviewNote,/Sunday pancakes with Aunt/);
    assert.equal(result.artifact.experience?.deed.scope,'PRIVATE_DRAFT');
  });
  it('rejects browser supplied receipt, actor, status and time before a DB call',async()=>{
    const response=await serveFirstDeed(new Request('http://localhost/api/first-deed',{
      method:'POST',headers:{Authorization:'Bearer fixture-token'},
      body:JSON.stringify({mode:'execute_continuation',locale:'en',wishId:'00000000-0000-4000-8000-000000000001',
        sourceId:'00000000-0000-4000-8000-000000000002',requestKey:'00000000-0000-4000-8000-000000000003',
        proposal:{},receipt:{status:'PREPARED',verified:true},actorJinnId:'forged',recordedAt:'2000-01-01',status:'PREPARED'})}));
    assert.equal(response.status,400);
    assert.equal((await response.json()).code,'invalid_request');
  });
  it('retires the unsafe prior-artifact continuation route',async()=>{
    const response=await serveFirstDeed(new Request('http://localhost/api/first-deed',{
      method:'POST',headers:{Authorization:'Bearer fixture-token'},
      body:JSON.stringify({mode:'continue',wishId:'00000000-0000-4000-8000-000000000001'})}));
    assert.equal(response.status,410);
  });
});
