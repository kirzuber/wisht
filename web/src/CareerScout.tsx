import { useState } from 'react';
import { ArrowLeft,ArrowRight,Bookmark,BriefcaseBusiness,ExternalLink,LockKeyhole,Search,ShieldAlert,Sparkles } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { ensureCareerWish } from './careerWishOwnership';
import { rollbackUnusedWish, type WishLink } from './wishOwnership';
import type { CareerResult,CareerCountry } from './careerTypes';
import WorkReceipts from './WorkReceipts';
import ResultNavigator from './ResultNavigator';
import NextDeed from './NextDeed';
import './careerScout.css';

type Props={
 wishId?:string;aspiration?:string;answer?:string;
 onBack:()=>void;onRequireAuth:()=>void;onSaved:()=>void;
};
const API=import.meta.env.VITE_API_BASE_URL||'';
const ERROR='Could not check remote job listings.';
export default function CareerScout({wishId,aspiration,answer,onBack,onRequireAuth,onSaved}:Props){
 const [query,setQuery]=useState('');
 const [experience,setExperience]=useState('');
 const [country,setCountry]=useState<CareerCountry>('CA');
 const [allowAi,setAllowAi]=useState(false);
 const [result,setResult]=useState<CareerResult|null>(null);
 const [editing,setEditing]=useState(true);
 const [activeIndex,setActiveIndex]=useState(0);
 const [lastInput,setLastInput]=useState('');
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [savedWish,setSavedWish]=useState<string|null>(null);

 const search=async()=>{
  if(busy)return;
  if(query.trim().length<3){setError('Enter a target role or specialty.');return;}
  setError('');setSavedWish(null);setResult(null);
  let token='';
  if(allowAi){
   if(experience.trim().length<20){setError('Add at least 20 characters about your experience for AI matching.');return;}
   try{
    await getAuthenticatedUser();
    const session=await getSupabase().auth.getSession();
    token=session.data.session?.access_token||'';
    if(!token)throw new Error('No session');
   }catch{
    onRequireAuth();return;
   }
  }
  setBusy(true);
  try{
   const request={
    query:query.trim(),country,experience:allowAi?experience.trim():'',allowAi
   };
   const response=await fetch(API+'/api/career-scout',{
    method:'POST',
    headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:JSON.stringify(request)
   });
   const payload=await response.json() as CareerResult&{error?:string};
   if(!response.ok)throw new Error(payload.error||ERROR);
   if(!Array.isArray(payload.jobs)||payload.source!=='himalayas_jobs')throw new Error('Unexpected career results.');
   setLastInput(JSON.stringify({query:request.query,country}));
   setResult(payload);setActiveIndex(0);setEditing(false);
  }catch(e){setError(e instanceof Error?e.message:ERROR);}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!result?.jobs.length||saving)return;
  if(lastInput!==JSON.stringify({query:query.trim(),country})){
   setError('Search again with your updated preferences before saving.');return;
  }
  setSaving(true);setError('');
  let link:WishLink|null=null;
  try{
   const user=await getAuthenticatedUser().catch(()=>{onRequireAuth();return null;});
   if(!user)return;
   link=await ensureCareerWish({wishId,aspiration,answer});
   const {data,error:e}=await getSupabase().from('career_shortlists').insert({
    user_id:user.id,wish_id:link.wishId,query:result.query,country:result.country,
    source:result.source,fetched_at:result.checkedAt,ai_used:result.aiUsed,
    matches:result.jobs
   }).select('id').single();
   if(e){
    if(e.code==='23505')throw new Error('You already saved a career shortlist today. Open My wishes to see it.');
    throw e;
   }
   if(!data)throw new Error('Could not confirm the saved shortlist.');
   setSavedWish(link.wishId);
  }catch(e){
   if(link)await rollbackUnusedWish(link);
   setError(e instanceof Error?e.message:'Could not save career findings.');
  }finally{setSaving(false);}
 };
 const changed=(fn:()=>void)=>{fn();setSavedWish(null);};
 const selectedJob=result?.jobs[activeIndex];
 return <section className="career-scout entrance">
  <button type="button" className="back" onClick={onBack}><ArrowLeft size={16}/> Back</button>
  {(!result||editing)&&<div className="career-heading">
   <div className="portfolio-spark"><BriefcaseBusiness size={22}/></div>
   <p className="eyebrow">ONE WISH · A CAREER DEED</p>
   <h2>Find your <em>next opportunity.</em></h2>
   <p>I'll look for real remote openings. If you opt in, I'll also compare them against your actual experience.</p>
  </div>}
  {result&&!editing&&<div className="result-search-summary"><div><span>{result.query} · {result.country==='worldwide'?'Worldwide':result.country} remote</span><small>{result.jobs.length} listings returned</small></div><button type="button" onClick={()=>setEditing(true)}>Change search</button></div>}
  {(!result||editing)&&<div className="career-form">
   <label>Target role or specialty
    <input value={query} maxLength={90} placeholder="e.g. Solution Architect, Product Manager, Java Engineer"
     onChange={e=>changed(()=>setQuery(e.target.value))}/>
   </label>
   <label>Where can you work remotely?
    <select value={country} onChange={e=>changed(()=>setCountry(e.target.value as CareerCountry))}>
     <option value="CA">Canada</option>
     <option value="US">United States</option>
     <option value="worldwide">Worldwide</option>
    </select>
   </label>
   <p className="career-notice"><ShieldAlert size={15}/> This first career scout covers remote jobs only. Local and hybrid openings aren't searched yet.</p>
   <label>Your experience (optional, unless using AI)
    <textarea value={experience} maxLength={650} rows={3}
     placeholder="Your background, real skills and goals. Don't include contact details or confidential employer information."
     onChange={e=>setExperience(e.target.value)}/>
   </label>
   <label className="career-consent">
    <input type="checkbox" checked={allowAi} onChange={e=>setAllowAi(e.target.checked)}/>
    <span><strong>Explain matches with AI.</strong> I agree to send this experience summary and excerpts of candidate job descriptions to the configured DeepSeek/OpenAI provider for a one-time assessment. No résumé upload. The summary won't be saved in my wish.</span>
   </label>
   <button type="button" className="primary" disabled={busy||query.trim().length<3} onClick={()=>void search()}>
    <Search size={17}/> {busy?'Checking remote openings…':'Find remote openings'} <ArrowRight size={16}/>
   </button>
   <p className="career-hint"><LockKeyhole size={13}/> Browse listings without an account. AI comparisons and saving require verified sign-in.</p>
  </div>}
  {error&&<p className="error" role="alert">{error}</p>}
  {result&&!editing&&<div className="career-results">
   <p className="eyebrow">SOURCE-BACKED RESULTS</p>
   <h3>{result.jobs.length} {result.jobs.length===1?'opening':'openings'} from Himalayas</h3>
   <p className="result-provenance">Source-indexed jobs · check employer availability before applying.</p>
   {result.aiStatus==='completed'&&<p className="career-ai"><Sparkles size={14}/> AI comparison completed using your supplied experience. Its judgments are advisory, not hiring decisions.</p>}
   {result.aiStatus==='unavailable'&&<p className="career-notice">AI matching was unavailable; showing genuine source listings without fabricated assessments.</p>}
   {!result.jobs.length&&<p className="career-notice">No suitable current remote listings were returned. Try a broader title or another region.</p>}
   {selectedJob&&<article key={selectedJob.id} className="career-job">
     <div className="career-job-top"><strong>{selectedJob.title}</strong><span>{selectedJob.company}</span></div>
     <p>{selectedJob.excerpt||selectedJob.description.slice(0,220)}</p>
     <small>{selectedJob.employmentType} · {selectedJob.salary}</small>
     {selectedJob.fit!=='not_assessed'&&<div className="career-fit">
       <strong>AI fit: {selectedJob.fit}</strong><p>{selectedJob.reason}</p>{selectedJob.gap&&<p>Check: {selectedJob.gap}</p>}
     </div>}
     <div className="career-job-links">
       <a href={selectedJob.sourceUrl} target="_blank" rel="noopener noreferrer">View listing <ExternalLink size={13}/></a>
       <a href={selectedJob.applicationLink} target="_blank" rel="noopener noreferrer">Apply at source <ExternalLink size={13}/></a>
     </div>
     <details className="result-evidence-details">
      <summary>Job details</summary>
      <p>{selectedJob.seniority||'Seniority not listed'} · {selectedJob.locations.length?selectedJob.locations.join(', '):'Location restrictions: check source'} · Posted {selectedJob.publishedAt==='Unknown'?'date unknown':new Date(selectedJob.publishedAt).toLocaleDateString()}</p>
     </details>
   </article>}
   <ResultNavigator noun="role" count={result.jobs.length} index={activeIndex} onChange={setActiveIndex}/>
   <details className="result-evidence-details">
    <summary>About these results</summary>
    <p>{result.evidenceScope}</p>
    <p>Checked {new Date(result.checkedAt).toLocaleString()}. {result.candidateCount} source candidates; displayed items are not ranked by suitability.</p>
    <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Source: Himalayas <ExternalLink size={12}/></a>
   </details>
   {result.jobs.length>0&&<button className="primary" type="button" disabled={saving||!!savedWish} onClick={()=>void save()}>
    <Bookmark size={16}/> {saving?'Saving career shortlist…':savedWish?'Saved under my wish':'Save all '+result.jobs.length+' openings'} <ArrowRight size={15}/>
   </button>}
   {savedWish&&<><p className="career-success">Saved to your career wish. No application was submitted.</p>
    {selectedJob&&<NextDeed title="Ready to explore this application?"
      detail={`You can review the employer's instructions for “${selectedJob.title}”. Jinn won't apply on your behalf.`}
      label="Open application page" href={selectedJob.applicationLink}
      note="You're leaving Jinn. Check the employer's requirements and availability."
    />}
    <details className="result-evidence-details"><summary>View Work Receipt</summary><WorkReceipts wishId={savedWish}/></details>
    <button type="button" className="back" onClick={onSaved}>Open My wishes <ArrowRight size={15}/></button>
   </>}
  </div>}
 </section>;
}
