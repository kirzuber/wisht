import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {callFirstDeedModel,loadOwnedWish,prepareDeed,reviewGrounding,serveFirstDeed,suggestClarification,validateArtifact} from '../src/firstDeed.ts';

it('reports missing provider config at clarification, even when the wish needs no question', async context => {
  const provider = process.env.LLM_PROVIDER;
  const key = process.env.OPENAI_API_KEY;
  process.env.LLM_PROVIDER = 'openai';
  delete process.env.OPENAI_API_KEY;
  const log = context.mock.method(console, 'error', () => undefined);
  try {
    const response = await serveFirstDeed(new Request('http://localhost/api/first-deed', {
      method: 'POST',
      body: JSON.stringify({ mode: 'clarify', wish: 'Create a reading log for the books I read this year' }),
    }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'ai_not_configured');
    assert.deepEqual(log.mock.calls[0].arguments, [
      '[Wisht] api deed.clarify.failed', { code: 'ai_not_configured', status: 503 },
    ]);
  } finally {
    if (provider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = provider;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
import {correctSource,validateEditedArtifact} from '../../web/src/firstWishModel.ts';

const book={title:'Story seed and interview kit',sections:[
  {type:'document',title:'Story seed',body:'Start with Sunday pancakes with Grandma. Ask what happened; do not assume details.'},
  {type:'questions',title:'Three interview prompts',items:['Who else remembers the meal?','What happened before or after?','What detail would you want future readers to know?']}],
  unknowns:['When did this happen?','Who else was there?'],
  nextDeed:{title:'Ask one person about this memory',why:'A second account can add details without guessing.',prompt:'Record their answer in this wish.'},
  boundary:'Private interview kit. No one was contacted or fact-checked.'};
const garden={title:'Vacant lot garden starter plan',sections:[
  {type:'checklist',title:'Dependencies',items:[{text:'Find who manages the lot'},
    {text:'Ask the manager for land-use permission',dependsOn:0},{text:'Ask neighbors if interested',dependsOn:1}]},
  {type:'document',title:'Neighbor inquiry draft',body:'Hi neighbors — I am exploring a garden. Would you like to share ideas? Draft only; not sent.'}],
  unknowns:['Lot owner is unknown.','Permission is not confirmed.'],
  nextDeed:{title:'Identify who controls the lot',why:'Permission cannot be sought until the right person is known.',prompt:'Record a verified owner or manager yourself.'},
  boundary:'No lookup, permission request or invitation was sent.'};
const plant={title:'Houseplant observation log',sections:[
  {type:'checklist',title:'Observe first',items:[{text:'Check whether soil is wet or dry'},{text:'Check drainage holes'}]},
  {type:'document',title:'Care log',body:'Date: ___; soil moisture: ___; light: ___; leaf changes: ___.'}],
  unknowns:['Cause of decline is not known.'],
  nextDeed:{title:'Record soil moisture',why:'An observation can narrow possible causes.',prompt:'Add what you see to the care log.'},
  boundary:'No photo was inspected, diagnosis verified or reminder scheduled.'};
const model=(result:unknown)=>async()=>result;
const approve=async()=>({safe:true} as const);
const reject=async()=>({safe:false,reason:'unconfirmed_location_or_permission'} as const);
const unsafeGarden={...garden,sections:[{type:'document',title:'First planting',body:'Use your backyard, which has six hours of sun.'}]};
const openGarden={...garden,title:'Options for starting a garden',
  sections:[{type:'questions',title:'Possible growing space',items:['Is there a place you could use?']}],
  unknowns:['A growing location has not been identified.'],
  nextDeed:{title:'List one possibility',why:'A possible location helps narrow the options.',prompt:'Write an option if you know one; otherwise leave it open.'},
  boundary:'Private planning only. No location or permission was verified.'};

describe('JINN-F03 generic first Deed',()=>{
  it('accepts only the fixed editable component grammar',()=>{
    assert.equal(validateArtifact(book,'Sunday pancakes with Grandma').sections.length,2);
    assert.throws(()=>validateArtifact({...book,sections:[{type:'html',title:'Bad',body:'<script />'}]},''));
    assert.throws(()=>validateArtifact({...garden,sections:[{type:'checklist',title:'Bad',items:[{text:'Second',dependsOn:1}]}]},''));
  });
  it('asks at most one question and tolerates an unsure answer',async()=>{
    assert.equal(await suggestClarification('I want a book about my family',model({question:'What is one memory you want to keep?'})),
      'What is one memory you want to keep?');
    const prepared=await prepareDeed('I want a book about my family','',null,model(book),approve);
    assert.equal(prepared.artifact.sourceNote,'');
    assert.equal(prepared.receipt.status,'PREPARED');
  });
  it('uses the same grammar for book, garden and unexpected wish',async()=>{
    const a=await prepareDeed('I want a book about my family','Sunday pancakes with Grandma',null,model(book),approve);
    const b=await prepareDeed('I want a garden on a vacant lot. Owner unknown.','',null,model(garden),approve);
    const c=await prepareDeed('My houseplant is unhealthy','',null,model(plant),approve);
    assert.deepEqual([a,b,c].map(x=>x.artifact.sections.map(s=>s.type)),
      [['document','questions'],['checklist','document'],['checklist','document']]);
    assert.match(b.artifact.nextDeed.title,/Identify/);
    assert.match(c.artifact.boundary,/No photo was inspected/);
  });
  it('keeps corrections authoritative for a subsequent deed',async()=>{
    const initial=validateArtifact({...book,title:'Grandma memory kit',sections:[
      {...book.sections[0],title:'Grandma story seed'},book.sections[1]]},'Sunday pancakes with Grandma');
    const corrected=correctSource(initial,'Sunday pancakes with Aunt');
    assert.doesNotMatch(JSON.stringify(corrected),/Grandma/);
    let sent='';
    await prepareDeed('I want a book about my family',corrected.sourceNote,corrected,
      async messages=>{sent=messages[1].content;return {...book,sections:[{type:'questions',title:'Follow-up',items:['What does Aunt recall?']}]} },approve);
    assert.match(sent,/Aunt/);
    assert.doesNotMatch(sent,/Grandma/);
  });
  it('rejects edits that would save but fail continuation validation',()=>{
    const artifact=validateArtifact(garden,'');
    assert.doesNotThrow(()=>validateEditedArtifact(artifact));
    assert.throws(()=>validateEditedArtifact({...artifact,unknowns:Array(7).fill('unknown')}),/six unknowns/);
  });
  it('labels unsupported sending as prepared, never sent or verified',async()=>{
    const result=await prepareDeed('Send these garden invitations now','',null,model(garden),approve);
    assert.equal(result.receipt.status,'PREPARED');
    assert.match(result.receipt.scope,/No external action/);
    assert.match(result.artifact.sections[1].type==='document'?result.artifact.sections[1].body:'',/not sent/);
  });
  it('repairs a rejected assumption once and independently reviews the replacement',async()=>{
    const reviewed:string[]=[];
    let generations=0;
    const result=await prepareDeed('I want to try gardening','',null,async messages=>{
      if (++generations===1) return unsafeGarden;
      assert.match(messages[0].content,/single repair attempt.*grounding_rejected/);
      assert.match(messages[1].content,/REJECTED PRIOR DRAFT/);
      assert.match(messages[1].content,/six hours of sun/);
      assert.match(messages[0].content,/Remove unsupported factual assertions/);
      return openGarden;
    },async(_wish,_note,artifact)=>{
      reviewed.push(artifact.title);
      return artifact.title===openGarden.title ? approve() : reject();
    });
    assert.equal(generations,2);
    assert.deepEqual(reviewed,[unsafeGarden.title,openGarden.title]);
    assert.equal(result.receipt.draftSource,'repaired_model');
    assert.equal(result.artifact.sourceNote,'');
    assert.match(result.artifact.unknowns.join(' '),/location/);
    assert.doesNotMatch(JSON.stringify(result.artifact),/backyard|six hours of sun/);
  });
  it('serves a fixed worksheet after two rejected drafts and preserves the exact source note',async()=>{
    let generations=0;
    const result=await prepareDeed('I want to try gardening','Where is still open.',null,
      async()=>{generations++; return unsafeGarden;},reject);
    assert.equal(generations,2);
    assert.equal(result.receipt.draftSource,'worksheet');
    assert.equal(result.artifact.sourceNote,'Where is still open.');
    assert.match(result.receipt.operation,/worksheet/);
    assert.doesNotMatch(JSON.stringify(result.artifact),/backyard|six hours of sun/);
  });
  it('keeps a saved follow-up artifact when a replacement fails both grounding checks',async()=>{
    await assert.rejects(
      prepareDeed('I want to try gardening','',validateArtifact(openGarden,''),model(unsafeGarden),reject),
      {code:'grounding_rejected',status:422},
    );
  });
  it('repairs an invalid section without letting it reach the reviewer',async()=>{
    let calls=0;
    const result=await prepareDeed('I want to try gardening','',null,async messages=>{
      if (++calls===1) return {...openGarden,sections:[{type:'html',title:'Unsupported'}]};
      assert.match(messages[0].content,/draft_validation_failed/);
      return openGarden;
    },async(_wish,_note,artifact)=>{
      assert.deepEqual(artifact.sections,openGarden.sections);
      return approve();
    });
    assert.equal(calls,2);
    assert.equal(result.receipt.draftSource,'repaired_model');
  });
  it('repairs an unparseable generation response without treating it as downtime',async()=>{
    let generations=0;
    const result=await prepareDeed('I want to try gardening','',null,async messages=>{
      if (++generations===1) return callFirstDeedModel([],1,{LLM_PROVIDER:'openai',OPENAI_API_KEY:'fixture'},
        async()=>Response.json({choices:[{message:{content:'{"sections": ['}}]}));
      assert.match(messages[0].content,/draft_validation_failed.*invalid_model_output/);
      return openGarden;
    },approve);
    assert.equal(generations,2);
    assert.equal(result.receipt.draftSource,'repaired_model');
  });
  it('does not treat malformed review or provider failure as rejection',async()=>{
    const artifact=validateArtifact(unsafeGarden,'');
    assert.deepEqual(await reviewGrounding('Garden','',artifact,model({safe:false})),
      {safe:false,reason:'unsupported_fact'});
    await assert.rejects(reviewGrounding('Garden','',artifact,model({safe:'false'})),{code:'grounding_review_invalid',status:502});
    let calls=0;
    const outage=()=>callFirstDeedModel([],1,{LLM_PROVIDER:'openai',OPENAI_API_KEY:'fixture'},
      async()=>new Response(null,{status:429}));
    await assert.rejects(prepareDeed('I want to try gardening','',null,async()=>{
      if (++calls===1) return unsafeGarden;
      return outage();
    },reject),{code:'ai_provider_rejected',status:503,upstreamStatus:429});
    assert.equal(calls,2);
  });
  it('requires an owner-scoped server read for continuation',async()=>{
    let filters:Array<[string,string]>=[];
    const query={
      eq(field:string,value:string){filters.push([field,value]);return this;},
      async single(){return {data:null,error:{message:'Not found'}};}
    };
    const factory=(()=>({
      auth:{getUser:async()=>({data:{user:{id:'owner',email_confirmed_at:'now',is_anonymous:false}},error:null})},
      from:()=>({select:()=>query})
    })) as never;
    await assert.rejects(loadOwnedWish('token','00000000-0000-0000-0000-000000000001',
      {VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'key'} as NodeJS.ProcessEnv,factory),/not found/);
    assert.deepEqual(filters,[['id','00000000-0000-0000-0000-000000000001'],['user_id','owner']]);
  });
  it('rejects unauthenticated continuation at the HTTP boundary',async()=>{
    const response=await serveFirstDeed(new Request('http://localhost/api/first-deed',{method:'POST',
      body:JSON.stringify({mode:'continue',wishId:'00000000-0000-0000-0000-000000000001'})}));
    assert.equal(response.status,401);
  });
  it('serves a complete guest first-Deed through the HTTP handler',async()=>{
    const original=globalThis.fetch;
    const provider=process.env.LLM_PROVIDER;
    const key=process.env.OPENAI_API_KEY;
    process.env.LLM_PROVIDER='openai';
    process.env.OPENAI_API_KEY='test-only-key';
    const outputs=[garden,{safe:true}];
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(outputs.shift())}}]}),
      {status:200,headers:{'Content-Type':'application/json'}});
    try{
      const response=await serveFirstDeed(new Request('http://localhost/api/first-deed',{method:'POST',
        body:JSON.stringify({mode:'prepare',wish:'Grow a garden',answer:'Owner unknown'})}));
      assert.equal(response.status,200);
      const result=await response.json();
      assert.equal(result.artifact.sourceNote,'Owner unknown');
      assert.equal(result.artifact.sections[0].type,'checklist');
      assert.equal(result.receipt.status,'PREPARED');
      assert.equal(outputs.length,0);
    }finally{globalThis.fetch=original;
      if(provider===undefined)delete process.env.LLM_PROVIDER;else process.env.LLM_PROVIDER=provider;
      if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
  });
});
