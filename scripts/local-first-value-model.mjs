// Local-only OpenAI-compatible fixture for transport/Auth/DB browser integration.
// NOT evidence of real-model product quality. Scenario samples below only test
// browser transport and persistence; production planning has no domain routes.
import http from 'node:http';

const port=3999;
const server=http.createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/v1/chat/completions'){
    res.writeHead(404).end();return;
  }
  let text='';
  for await (const chunk of req){text+=chunk;if(text.length>20000){res.writeHead(413).end();return;}}
  let input;try{input=JSON.parse(text)}catch{res.writeHead(400).end();return}
  const prompt=input.messages?.[0]?.content||'';
  const userText=input.messages?.[1]?.content||'';
  const continuation=/"priorWishData":\{/.test(userText)||userText.includes('PRIOR AI-AUTHORED DRAFT');
  const locale=prompt.match(/Selected interface locale: (en|ru|fr|es)/)?.[1]||'en';
  let output;
  if(prompt.includes('PLAN_FEASIBILITY_GATE')){
    output={feasible:true,reason:'none'};
  }else if(prompt.includes('private First-Value planner')){
    // Deliberately omit all server-owned layout, scope, locale and version
    // fields: local browser coverage tests the semantic-only model contract.
    output={
      intent:continuation?'Advance the saved Wish with another private result':'Prepare an immediately useful first result from the Wish',
      firstOutcome:continuation?'One new authored follow-up document from confirmed context':'One reusable first draft that can be reviewed, corrected and kept',
      deed:{title:continuation?'Compose the next private document':'Compose a first draft',
        result:continuation?'A new document using only confirmed input and prior draft as work':'A private document prepared only from the Wish and the person’s optional answer'},
      questions:continuation?[]:[{prompt:'Which direction would make the first draft more useful?',
        why:'A selected focus changes the writing without assuming unknown personal facts',
        choices:['Practical first step','Creative example']}],
      supportingMaterial:true,
    };
  }else if(prompt.includes('Review a proposed private draft')){
    output={safe:true,promiseFulfilled:true};
  }else{
    const context=userText;
    const wish=context.match(/Goal: ([^\n]+)/)?.[1]||'This Wish';
    const confirmed=context.match(/CONFIRMED USER CLAIMS[^\n]*: (\[[^\n]*\])/)?.[1]||'[]';
    const source=context.match(/Source note \(user choices only\): ([^\n]+)/)?.[1]||'';
    const approved=continuation?[source,JSON.parse(confirmed).join(' ')].filter(Boolean).join(' '):'';
    let paragraph=continuation?
      `Private follow-up text for ${wish}. Confirmed input: ${approved||'No additional personal detail was confirmed.'} This is new editable wording built after the earlier draft. It treats prior AI text as a draft rather than evidence of lived events. Other people, places, contact and permissions remain unknown. Nothing was sent or verified. The person may keep or correct this language without endorsing any unconfirmed claim. `:
      `Suggested and editable private draft for: ${wish}. This wording is an example of the first usable outcome, not a statement of a real event, verified fact or performed external action. The reader can take this draft immediately and adapt the sections to the facts they know. If details about people, places or permission are missing, those details remain explicit unknowns, and the draft does not assert them as true. `;
    if(continuation&&/life story/i.test(wish))paragraph=`A possible chapter opening, based only on the memory you confirmed: Sunday pancakes with Aunt.\n\nI want to begin with that simple phrase because it is mine to keep. Sunday pancakes with Aunt. I do not need to borrow a setting, a date or anyone else's words to know that this memory belongs in the story I am making. The scene can stay modest while I decide what else I truly remember.\n\nFor now, the opening gives the reader one clear thread. There was a Sunday. There were pancakes. Aunt was part of it. I can pause there and let those three details carry their own weight. I can ask what this moment means to me now without pretending to know what anyone else thought at the time. If more comes back to me, I can add it in my own words. If it does not, the absence can remain honest.\n\nThis is a beginning rather than a full account. It leaves room for the next memory, the next choice of emphasis and the voice I want this book to have. Nothing in this draft needs to turn a guess into a fact. `;
    if(continuation&&/community garden/i.test(wish))paragraph=`UNSENT PERMISSION ENQUIRY — private draft only.\n\nHello,\n\nI am exploring whether a community garden might be possible on a suitable site. I have not identified the landowner or confirmed any permission, so I am preparing this wording for later use only. If you are the person authorized to consider a request about a specific site, would you be willing to explain whether gardening use could be discussed and what information or process you would require? I would welcome guidance on who is responsible for the site, whether access or safety conditions apply, and what approvals would need to come before any planning on the land.\n\nI will not treat this draft as permission and will not begin work on a site without the appropriate agreement. Thank you for considering the enquiry.\n\n[Your name, if you choose to send this later] `;
    output={
      language:locale,title:continuation?'Your next private document':'Your first usable draft',
      sections:[{type:'document',title:'A concrete prepared starting text',body:continuation&&(/life story|community garden/i).test(wish)?paragraph:paragraph.repeat(2)},
        {type:'questions',title:'One optional refinement',items:['What single known detail would improve this draft?']}],
      unknowns:['No external facts or permissions were checked.'],
      nextDeed:{title:continuation?'Choose another confirmed direction':'Refine the first draft',why:'Use the next known fact rather than inventing one.',
        prompt:'Add one confirmed detail when you are ready.'},
      boundary:'Private draft only. No web research, sending, verification or outside execution.',
    };
  }
  const body=JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]});
  res.writeHead(200,{'content-type':'application/json'}).end(body);
});
server.listen(port,'127.0.0.1',()=>console.log('Local-only first-value model fixture on 127.0.0.1:'+port));
