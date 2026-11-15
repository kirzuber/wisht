import { useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, CalendarDays, Compass, ExternalLink, LockKeyhole, Search } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { ensurePhotographyWish, rollbackUnusedWish, type PortfolioWishContext, type WishLink } from './wishOwnership';
import type { ScoutResult, PhotoGenre } from './opportunityTypes';
import WorkReceipts from './WorkReceipts';
import ResultNavigator from './ResultNavigator';
import NextDeed from './NextDeed';
import './opportunityScout.css';

type Props={
 wishContext:PortfolioWishContext;
 initialGenre?:PhotoGenre;
 preview:ScoutResult|null;
 onPreview:(data:ScoutResult|null)=>void;
 onBack:()=>void;
 onRequireAuth:()=>void;
 onSaved:()=>void;
 onPrepareSubmission:(wishId:string,shortlistId:string,opportunityId:string)=>void;
};
const OPTIONS:{value:PhotoGenre;label:string}[]=[
 {value:'any',label:'Anything'}, {value:'nature',label:'Nature & wildlife'},
 {value:'portrait',label:'Portraits'}, {value:'open',label:'Open theme'}
];
const API=import.meta.env.VITE_API_BASE_URL||'';

export default function OpportunityScout({wishContext,initialGenre='any',preview,onPreview,onBack,onRequireAuth,onSaved,onPrepareSubmission}:Props){
 const [genre,setGenre]=useState<PhotoGenre>(initialGenre);
 const [freeOnly,setFreeOnly]=useState(true);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [savedWishId,setSavedWishId]=useState<string|null>(null);
 const [savedShortlistId,setSavedShortlistId]=useState<string|null>(null);
 const [editing,setEditing]=useState(true);
 const [activeIndex,setActiveIndex]=useState(0);

 const run=async()=>{
  if(loading)return;
  setLoading(true);setError('');setSavedWishId(null);setSavedShortlistId(null);onPreview(null);
  try{
   const query=new URLSearchParams({genre,free:String(freeOnly)});
   const res=await fetch(API+'/api/scout?'+query.toString());
   const data=await res.json() as ScoutResult & {error?:string};
   if(!res.ok)throw new Error(data.error||'The opportunity source could not be checked.');
   if(!Array.isArray(data.opportunities) || !data.feedUrl)throw new Error('Unexpected opportunity response.');
   onPreview(data);setEditing(false);setActiveIndex(0);
  }catch(cause){setError(cause instanceof Error?cause.message:'The search could not be completed.');}
  finally{setLoading(false);}
 };
 const save=async()=>{
  if(!preview?.opportunities.length||saving)return;
  setSaving(true);setError('');
  let link:WishLink|null=null;
  try{
   const user=await getAuthenticatedUser().catch(()=>{
    onRequireAuth();
    return null;
   });
   if(!user)return;
   // Read the public source before authentication; only persist after verified sign-in.
   link=await ensurePhotographyWish({...wishContext,missionId:'find-photo-opportunities',answer:genre});
   const {data,error:insertError}=await getSupabase().from('opportunity_shortlists')
    .insert({
      user_id:user.id,wish_id:link.wishId,genre:preview.filters.genre,
      free_only:preview.filters.freeOnly,source:preview.source,feed_url:preview.feedUrl,
      fetched_at:preview.checkedAt,matches:preview.opportunities
    }).select('id').single();
   if(insertError){
    if(insertError.code==='23505')throw new Error('You already saved a scouting list today for this wish. Open My wishes to review it.');
    throw insertError;
   }
   if(!data)throw new Error('The saved shortlist could not be confirmed.');
   setSavedWishId(link.wishId);
   setSavedShortlistId(data.id as string);
  }catch(cause){
   if(link)await rollbackUnusedWish(link);
   setError(cause instanceof Error?cause.message:'Could not save your scouting results.');
  }finally{setSaving(false);}
 };
 const selectedQueryMatches=preview?.filters.genre===genre&&preview?.filters.freeOnly===freeOnly;
 const selectedOpportunity=preview?.opportunities[activeIndex];
 return <section className="scout-workspace entrance">
  <button type="button" className="portfolio-back" onClick={onBack}><ArrowLeft size={16}/> Back</button>
  {(!preview||editing)&&<div className="scout-heading">
   <div className="portfolio-spark"><Compass size={22}/></div>
   <p className="eyebrow">ONE WISH · A NEW DEED</p>
   <h2>I'll look for <em>your next opening.</em></h2>
   <p>Let me check current public photography calls and bring back a short list with deadlines and source links.</p>
  </div>}
  {preview&&!editing&&<div className="result-search-summary"><div><span>{OPTIONS.find(o=>o.value===preview.filters.genre)?.label||'Photography'} · {preview.filters.freeOnly?'Free entry only':'All fees'}</span><small>{preview.opportunities.length} source listings returned</small></div><button type="button" onClick={()=>setEditing(true)}>Change search</button></div>}
  {(!preview||editing)&&<div className="scout-controls">
   <label className="scout-field-label">What kind of photography?</label>
   <div className="scout-options">{OPTIONS.map(opt=><button type="button"
    key={opt.value} className={genre===opt.value?'selected':''}
    aria-pressed={genre===opt.value} onClick={()=>{setGenre(opt.value);setSavedWishId(null);}}>
    {opt.label}
   </button>)}</div>
   <label className="scout-free">
    <input type="checkbox" checked={freeOnly}
     onChange={e=>{setFreeOnly(e.target.checked);setSavedWishId(null);}}/>
    Show free-entry listings only
   </label>
   <button className="primary" type="button" onClick={()=>void run()} disabled={loading}>
    <Search size={17}/>{loading?'Checking public listings…':'Find opportunities'} <ArrowRight size={16}/>
   </button>
   <p className="scout-caption"><LockKeyhole size={14}/> No account or wish slot needed to search. Save only when you want to keep the results.</p>
  </div>}
  {error && <p className="error" role="alert">{error}</p>}
  {preview&&!editing && <div className="scout-findings">
   <div className="scout-findings-header">
    <div><p className="eyebrow">SCOUT FINDINGS</p><h3>{preview.opportunities.length} {preview.opportunities.length===1?'potential opening':'potential openings'}</h3></div>
    <span>Calendar listings · organizer not verified</span>
   </div>
   {!selectedQueryMatches && <p className="scout-notice">Your preferences changed. Run the scout again to refresh these results.</p>}
   {!preview.opportunities.length && <p className="scout-empty">No matching future deadlines were found in the indexed calendar. Try a broader topic or include paid calls. I won't invent opportunities.</p>}
   {selectedOpportunity&&<article className="scout-opportunity" key={selectedOpportunity.id}>
    <div className="scout-opportunity-meta"><CalendarDays size={13}/> Listed deadline: {selectedOpportunity.deadline}</div>
    <h4>{selectedOpportunity.title}</h4>
    {selectedOpportunity.summary&&<p>{selectedOpportunity.summary}</p>}
    <a href={selectedOpportunity.sourceUrl} target="_blank" rel="noopener noreferrer">View listing <ExternalLink size={14}/></a>
    <details className="result-evidence-details">
     <summary>Listing notes</summary>
     <p>{selectedOpportunity.relevance}</p>
     <p>{selectedOpportunity.feeNote}</p>
    </details>
   </article>}
   <ResultNavigator noun="opportunity" count={preview.opportunities.length} index={activeIndex} onChange={setActiveIndex}/>
   <details className="result-evidence-details">
    <summary>About this search</summary>
    <p>{preview.evidenceScope}</p>
    <p>Checked {new Date(preview.checkedAt).toLocaleString()}. Results are source-ordered and not organizer-verified.</p>
    <a href={preview.feedUrl} target="_blank" rel="noopener noreferrer">Source calendar <ExternalLink size={12}/></a>
   </details>
   {preview.opportunities.length>0 && <button className="primary" type="button"
    disabled={saving||!!savedWishId||!selectedQueryMatches} onClick={()=>void save()}>
    <Bookmark size={17}/> {saving?'Saving your shortlist…':savedWishId?'Shortlist saved':'Save all '+preview.opportunities.length+' findings'} <ArrowRight size={16}/>
   </button>}
   {savedWishId && <>
    <p className="scout-success">Saved under your photography wish. Jinn hasn't submitted anything.</p>
    {savedShortlistId&&selectedOpportunity&&<NextDeed
      title="Want to prepare an entry?"
      detail={`I can help you prepare a private submission draft for “${selectedOpportunity.title}”. You'll review the organizer's rules first.`}
      label="Prepare a submission draft"
      note="Preparation only. No external submission or eligibility verification."
      onAction={()=>onPrepareSubmission(savedWishId,savedShortlistId,selectedOpportunity.id)}
    />}
    <details className="result-evidence-details"><summary>View Work Receipt</summary><WorkReceipts wishId={savedWishId}/></details>
    <button className="back" type="button" onClick={onSaved}>Open My wishes <ArrowRight size={15}/></button>
   </>}
  </div>}
 </section>;
}
