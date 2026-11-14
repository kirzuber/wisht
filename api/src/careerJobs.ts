/** JINN-004.1: bounded, remote-only discovery from the permitted Himalayas API.
 * Every listing is index-observed; employment and eligibility are NOT certified.
 */
export type CareerCountry='CA'|'US'|'worldwide';
export type CareerInput={query:string;experience:string;country:CareerCountry;allowAi:boolean};
export type CareerJob={
 id:string;title:string;company:string;excerpt:string;description:string;
 sourceUrl:string;applicationLink:string;publishedAt:string;expiresAt:string|null;
 employmentType:string;seniority:string;locations:string[];
 salary:string;fit:'not_assessed'|'promising'|'possible'|'unclear';reason:string;gap:string;
};
export type CareerResults={
 source:'himalayas_jobs';checkedAt:string;country:CareerCountry;query:string;
 jobs:CareerJob[];candidateCount:number;aiUsed:boolean;aiStatus:'not_requested'|'completed'|'unavailable';
 evidenceScope:string;
};
const ORIGIN='https://himalayas.app';
const MAX_RESPONSE=2_000_000;
const strip=(value:string)=>value.replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const safeLink=(value:unknown):string|null=>{
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  return value;
 }catch{return null;}
};
const verifiedListing=(value:unknown):string|null=>{
 const link=safeLink(value);
 if(!link)return null;
 const url=new URL(link);
 return url.origin===ORIGIN&&/^\/companies\/[a-z0-9-]+\/jobs\/[a-z0-9-]+\/?$/.test(url.pathname)?ORIGIN+url.pathname.replace(/\/$/,''):null;
};
export function validateCareerInput(input:unknown):CareerInput{
 if(!input||typeof input!=='object')throw new Error('Specify your career search preferences.');
 const o=input as Record<string,unknown>;
 const query=typeof o.query==='string'?o.query.trim():'';
 const experience=typeof o.experience==='string'?o.experience.trim():'';
 if(query.length<3||query.length>90)throw new Error('Describe your target role in 3–90 characters.');
 if(experience.length>650)throw new Error('Experience summary is limited to 650 characters.');
 if(!['CA','US','worldwide'].includes(String(o.country)))throw new Error('Choose Canada, United States, or worldwide remote roles.');
 if(typeof o.allowAi!=='boolean')throw new Error('Specify whether AI analysis is authorized.');
 if(o.allowAi && experience.length<20)throw new Error('For AI matching, provide at least 20 characters about your experience.');
 return {query,experience,country:o.country as CareerCountry,allowAi:o.allowAi};
}
function pay(job:Record<string,unknown>):string{
 const currency=typeof job.currency==='string'?job.currency:'';
 const min=typeof job.minSalary==='number'?job.minSalary:null;
 const max=typeof job.maxSalary==='number'?job.maxSalary:null;
 if(!currency||(!min&&!max))return 'Not disclosed';
 const period=typeof job.salaryPeriod==='string'?job.salaryPeriod:'unspecified';
 return currency+' '+(min!==null?min.toLocaleString('en-US'):'?')+'–'+(max!==null?max.toLocaleString('en-US'):'?')+' / '+period;
}
export function parseCareerJobs(payload:unknown,now=new Date()):CareerJob[]{
 const obj=payload as {jobs?:unknown} | null;
 if(!obj||!Array.isArray(obj.jobs))throw new Error('Unexpected jobs-source response.');
 const result:CareerJob[]=[];const seen=new Set<string>();
 for(const raw of obj.jobs.slice(0,60)){
  if(!raw||typeof raw!=='object')continue;
  const job=raw as Record<string,unknown>;
  const sourceUrl=verifiedListing(job.guid);
  const applicationLink=safeLink(job.applicationLink);
  const title=typeof job.title==='string'?strip(job.title).slice(0,160):'';
  const company=typeof job.companyName==='string'?strip(job.companyName).slice(0,120):'';
  if(!sourceUrl||!applicationLink||!title||!company||seen.has(sourceUrl))continue;
  const expiry=typeof job.expiryDate==='number'&&job.expiryDate>0?new Date(job.expiryDate*1000):null;
  if(expiry&&expiry.getTime()<now.getTime())continue;
  const published=typeof job.pubDate==='number'&&job.pubDate>0?new Date(job.pubDate*1000):null;
  if(published&&published.getTime()>now.getTime()+86_400_000)continue;
  seen.add(sourceUrl);
  const places=Array.isArray(job.locationRestrictions)?job.locationRestrictions
    .map((v:unknown)=>v&&typeof v==='object'&&(v as {name?:string}).name).filter((v):v is string=>typeof v==='string')
    .slice(0,5):[];
  result.push({
   id:sourceUrl,title,company,sourceUrl,applicationLink,
   excerpt:strip(typeof job.excerpt==='string'?job.excerpt:'').slice(0,400),
   description:strip(typeof job.description==='string'?job.description:'').slice(0,1250),
   publishedAt:published?published.toISOString():'Unknown',
   expiresAt:expiry?expiry.toISOString():null,
   employmentType:typeof job.employmentType==='string'?job.employmentType:'Not specified',
   seniority:Array.isArray(job.seniority)?job.seniority.filter((v):v is string=>typeof v==='string').join(', '):'',
   locations:places,salary:pay(job),
   fit:'not_assessed',reason:'Not assessed against your experience.',gap:''
  });
 }
 return result.slice(0,5);
}
export async function findRemoteCareerJobs(input:CareerInput,fetcher:typeof fetch=fetch,now=new Date()):Promise<CareerResults>{
 const query=new URL(ORIGIN+'/jobs/api/search');
 query.searchParams.set('q',input.query);
 if(input.country!=='worldwide')query.searchParams.set('country',input.country);
 else query.searchParams.set('worldwide','true');
 query.searchParams.set('sort','recent');query.searchParams.set('page','1');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const r=await fetcher(query,{signal:controller.signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(r.status===429?'Job source rate limit reached. Try later.':'Remote jobs source unavailable.');
  if(Number(r.headers.get('content-length')||'0')>MAX_RESPONSE)throw new Error('Jobs response exceeds size limit.');
  const text=await r.text();if(text.length>MAX_RESPONSE)throw new Error('Jobs response exceeds size limit.');
  const parsed=JSON.parse(text) as {jobs?:unknown;totalCount?:number};
  const jobs=parseCareerJobs(parsed,now);
  return {
   source:'himalayas_jobs',checkedAt:now.toISOString(),query:input.query,country:input.country,
   jobs,candidateCount:typeof parsed.totalCount==='number'?parsed.totalCount:jobs.length,
   aiUsed:false,aiStatus:'not_requested',
   evidenceScope:'Remote jobs indexed by Himalayas, updated daily. Employer availability, work authorization, pay and role requirements are not independently confirmed. Recheck before applying.'
  };
 }catch(err){
  if(err instanceof Error&&/source|response|rate limit/i.test(err.message))throw err;
  throw new Error('Could not retrieve current remote jobs. No opportunities were invented.');
 }finally{clearTimeout(timeout);}
}
