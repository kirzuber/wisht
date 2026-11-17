// Local-only OpenAI-compatible fixture for transport/Auth/DB browser integration.
// NOT evidence of real-model product quality. No domain, Wish or user data branches.
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
  const locale=prompt.match(/Selected interface locale: (en|ru|fr|es)/)?.[1]||'en';
  let output;
  if(prompt.includes('PLAN_FEASIBILITY_GATE')){
    output={feasible:true,reason:'none'};
  }else if(prompt.includes('private First-Value planner')){
    // Deliberately omit all server-owned layout, scope, locale and version
    // fields: local browser coverage tests the semantic-only model contract.
    output={
      intent:'Prepare an immediately useful first result from the Wish',
      firstOutcome:'One reusable first draft that can be reviewed, corrected and kept',
      deed:{title:'Compose a first draft',
        result:'A private document prepared only from the Wish and the person’s optional answer'},
      questions:[{prompt:'Which direction would make the first draft more useful?',
        why:'A selected focus changes the writing without assuming unknown personal facts',
        choices:['Practical first step','Creative example']}],
      supportingMaterial:true,
    };
  }else if(prompt.includes('Review a proposed private draft')){
    output={safe:true,promiseFulfilled:true};
  }else{
    const context=input.messages?.[1]?.content||'';
    const wish=context.match(/Goal: ([^\n]+)/)?.[1]||'This Wish';
    const paragraph=`Suggested and editable private draft for: ${wish}. This wording is an example of the first usable outcome, not a statement of a real event, verified fact or performed external action. The reader can take this draft immediately and adapt the sections to the facts they know. If details about people, places or permission are missing, those details remain explicit unknowns, and the draft does not assert them as true. `;
    output={
      language:locale,title:'Your first usable draft',
      sections:[{type:'document',title:'A concrete prepared starting text',body:paragraph.repeat(2)},
        {type:'questions',title:'One optional refinement',items:['What single known detail would improve this draft?']}],
      unknowns:['No external facts or permissions were checked.'],
      nextDeed:{title:'Refine the first draft',why:'Use the next known fact rather than inventing one.',
        prompt:'Add one confirmed detail when you are ready.'},
      boundary:'Private draft only. No web research, sending, verification or outside execution.',
    };
  }
  const body=JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]});
  res.writeHead(200,{'content-type':'application/json'}).end(body);
});
server.listen(port,'127.0.0.1',()=>console.log('Local-only first-value model fixture on 127.0.0.1:'+port));
