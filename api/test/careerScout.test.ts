import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {findRemoteCareerJobs,parseCareerJobs,validateCareerInput} from '../src/careerJobs.ts';
import {assessCareerJobs} from '../src/careerReasoning.ts';
const input={query:'solution architect',country:'CA' as const,experience:'Architecture leadership with Azure and large delivery teams',allowAi:false};
const job=(title:string,slug:string)=>({
 guid:'https://himalayas.app/companies/acme/jobs/'+slug,
 applicationLink:'https://himalayas.app/companies/acme/jobs/'+slug,
 title,companyName:'Acme',excerpt:'Architecture and delivery',description:'<p>Azure, solution design, delivery</p>',
 pubDate:1794672000,expiryDate:1830297600,locationRestrictions:[{alpha2:'CA',name:'Canada'}],
 minSalary:150000,maxSalary:190000,salaryPeriod:'annual',currency:'CAD'
});
describe('Real remote career source adapter',()=>{
 it('rejects vague or oversized input',()=>{
  assert.throws(()=>validateCareerInput({...input,query:'a'}));
  assert.throws(()=>validateCareerInput({...input,experience:'a'.repeat(651)}));
  assert.throws(()=>validateCareerInput({...input,allowAi:true,experience:''}));
 });
 it('filters expired, unsafe, or duplicate jobs and preserves application links',()=>{
  const source=job('Solution Architect','solution-architect');
  const jobs=parseCareerJobs({jobs:[source,source,{...job('Old','old'),expiryDate:1700000000},
    {...job('Evil','evil'),guid:'https://evil.example/job'}]},new Date('2026-11-14T00:00:00Z'));
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].sourceUrl,source.guid);
  assert.equal(jobs[0].applicationLink,source.applicationLink);
  assert.equal(jobs[0].salary,'CAD 150,000–190,000 / annual');
 });
 it('fetches only permitted search parameters, never invents jobs',async()=>{
  let requested='';
  const result=await findRemoteCareerJobs(input,(async(url:RequestInfo|URL)=>{
   requested=String(url);return new Response(JSON.stringify({jobs:[job('Solution Architect','role')],totalCount:1}),{status:200});
  }) as typeof fetch,new Date('2026-11-14T00:00:00Z'));
  assert.match(requested,/himalayas.app\/jobs\/api\/search/);
  assert.match(requested,/country=CA/);
  assert.equal(result.jobs.length,1);
  assert.equal(result.aiStatus,'not_requested');
 });
 it('makes source outage an error',async()=>{
  await assert.rejects(()=>findRemoteCareerJobs(input,(async()=>new Response('',{status:503})) as typeof fetch),/source unavailable/i);
 });
 it('limits model output to existing indexes and uses only returned judgments',async()=>{
  const found=parseCareerJobs({jobs:[job('Solution Architect','role')]},new Date('2026-11-14T00:00:00Z'));
  const fake=(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({assessments:[
   {index:0,fit:'possible',reason:'Azure experience matches listed cloud requirement.',gap:'Security scope not confirmed'},
   {index:4,fit:'promising',reason:'Invented role'}
  ]})}}]}),{status:200})) as typeof fetch;
  const out=await assessCareerJobs({...input,allowAi:true},found,fake,{LLM_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test'});
  assert.equal(out.status,'completed');assert.equal(out.jobs.length,1);
  assert.equal(out.jobs[0].fit,'possible');
  assert.match(out.jobs[0].reason,/Azure/);
 });
});
