import {useState} from 'react';
import {ArrowLeft,ArrowRight,Bookmark,ExternalLink,MapPin,ShieldAlert} from 'lucide-react';
import {getAuthenticatedUser,getSupabase} from './supabaseClient';
import {ensureSoccerWish} from './soccerWishOwnership';
import {rollbackUnusedWish,type WishLink} from './wishOwnership';
import type {SoccerAge,SoccerLevel,SoccerResult} from './soccerTypes';
import WorkReceipts from './WorkReceipts';
import ResultNavigator from './ResultNavigator';
import './careerScout.css';
import './soccerScout.css';
type Props={wishId?:string;aspiration?:string;answer?:string;onBack:()=>void;onRequireAuth:()=>void;onSaved:()=>void};
const API=import.meta.env.VITE_API_BASE_URL||'';
export default function SoccerScout({wishId,aspiration,answer,onBack,onRequireAuth,onSaved}:Props){
 const initial:SoccerLevel=answer==='competitive'?'competitive':answer==='recreational'?'recreational':'beginner';
 const [city,setCity]=useState('');
 const [level,setLevel]=useState<SoccerLevel>(initial);
 const [ageGroup,setAgeGroup]=useState<SoccerAge>('adult');
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [result,setResult]=useState<SoccerResult|null>(null);
 const [editing,setEditing]=useState(true);
 const [activeIndex,setActiveIndex]=useState(0);
 const [savedWish,setSavedWish]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [searched,setSearched]=useState('');
 const fingerprint=()=>JSON.stringify({city:city.trim().toLowerCase(),level,ageGroup});
 const search=async()=>{
  if(busy)return;
  setError('');setResult(null);setSavedWish(null);
  if(city.trim().length<2){setError('Enter a city in Ontario.');return;}
  setBusy(true);
  try{
   const response=await fetch(API+'/api/soccer-scout',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({city:city.trim(),level,ageGroup})
   });
   const payload=await response.json() as SoccerResult&{error?:string};
   if(!response.ok)throw new Error(payload.error||'Could not look up soccer clubs.');
   if(payload.source!=='curated_ontario_clubs_v1'||!Array.isArray(payload.clubs))throw new Error('Unexpected soccer catalogue response.');
   setResult(payload);setSearched(fingerprint());setActiveIndex(0);setEditing(false);
  }catch(e){setError(e instanceof Error?e.message:'Could not look up soccer clubs.');}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!result?.clubs.length||saving)return;
  if(searched!==fingerprint()){setError('Check your updated preferences before saving.');return;}
  setSaving(true);setError('');
  let link:WishLink|null=null;
  try{
   const user=await getAuthenticatedUser().catch(()=>{onRequireAuth();return null;});
   if(!user)return;
   link=await ensureSoccerWish({wishId,aspiration,answer});
   const {data,error:e}=await getSupabase().from('soccer_shortlists').insert({
    user_id:user.id,wish_id:link.wishId,city:result.city,level:result.level,
    age_group:result.ageGroup,source:result.source,fetched_at:result.checkedAt,
    matches:result.clubs
   }).select('id').single();
   if(e){
    if(e.code==='23505')throw new Error('You already saved soccer research today. Open My wishes to review it.');
    throw e;
   }
   if(!data)throw new Error('Could not confirm saved research.');
   setSavedWish(link.wishId);
  }catch(e){
   if(link)await rollbackUnusedWish(link);
   setError(e instanceof Error?e.message:'Could not save soccer research.');
  }finally{setSaving(false);}
 };
 const changed=(f:()=>void)=>{f();setSavedWish(null);};
 const selectedClub=result?.clubs[activeIndex];
 return <section className="career-scout soccer-scout entrance">
  <button type="button" className="back" onClick={onBack}><ArrowLeft size={16}/> Back</button>
  {(!result||editing)&&<div className="career-heading">
   <div className="portfolio-spark"><MapPin size={22}/></div>
   <p className="eyebrow">ONE WISH · FIND A PLACE TO PLAY</p>
   <h2>Find your <em>first pitch.</em></h2>
   <p>I'll show you documented soccer clubs and programs near your chosen Ontario city. You can check with them directly about joining.</p>
  </div>}
  {result&&!editing&&<div className="result-search-summary"><div><span>{result.city} · {result.level} · {result.ageGroup}</span><small>Ontario club catalogue</small></div><button type="button" onClick={()=>setEditing(true)}>Change search</button></div>}
  {(!result||editing)&&<div className="career-form">
   <label>Which Ontario city?
    <input value={city} maxLength={65} placeholder="e.g. Burlington, Oakville, Toronto" list="soccer-cities"
      onChange={e=>changed(()=>setCity(e.target.value))}/>
    <datalist id="soccer-cities">{['Burlington','Oakville','Mississauga','Guelph','Toronto','Ottawa'].map(x=><option key={x} value={x}/>)}</datalist>
   </label>
   <label>What type of soccer?
    <select value={level} onChange={e=>changed(()=>setLevel(e.target.value as SoccerLevel))}>
     <option value="beginner">I'm just starting</option><option value="recreational">Recreational</option><option value="competitive">Competitive</option>
    </select>
   </label>
   <label>Who will be playing?
    <select value={ageGroup} onChange={e=>changed(()=>setAgeGroup(e.target.value as SoccerAge))}>
     <option value="adult">Adult</option><option value="youth">Child / teen (no personal details needed)</option>
    </select>
   </label>
   <p className="career-notice"><ShieldAlert size={15}/> This is a small, hand-verified Ontario pilot catalogue, not a real-time search of every club or live tryouts. No sign-in needed to explore.</p>
   <button className="primary" type="button" disabled={busy||city.trim().length<2} onClick={()=>void search()}>
    {busy?'Checking known clubs…':'Find soccer clubs'} <ArrowRight size={16}/>
   </button>
  </div>}
  {error&&<p className="error" role="alert">{error}</p>}
  {result&&!editing&&<div className="career-results">
   <p className="eyebrow">SOURCE-BACKED CLUBS</p>
   <h3>{result.clubs.length} {result.clubs.length===1?'club / program':'clubs / programs'} documented for {result.city}</h3>
   <p className="result-provenance">Documented club programs, not confirmed registration availability.</p>
   {result.clubs.length===0&&<p className="career-notice">No matching entry in our limited catalogue. This does not mean there are no clubs in your area. Try another category or use the official Canada Soccer club directory below.</p>}
   {selectedClub&&<article className="career-job" key={selectedClub.id}>
    <div className="career-job-top"><strong>{selectedClub.name}</strong><span>{selectedClub.city} · {selectedClub.region}</span></div>
    <p>{selectedClub.programNote}</p>
    <div className="career-job-links">
     <a href={selectedClub.programUrl} target="_blank" rel="noopener noreferrer">View program <ExternalLink size={13}/></a>
     <a href={selectedClub.sourceUrl} target="_blank" rel="noopener noreferrer">Club website <ExternalLink size={13}/></a>
    </div>
    <p className="soccer-confirm">Ask the club about registration, available places and eligibility.</p>
   </article>}
   <ResultNavigator noun="club" count={result.clubs.length} index={activeIndex} onChange={setActiveIndex}/>
   <details className="result-evidence-details">
    <summary>About these club listings</summary>
    <p>{result.evidenceScope} {result.coverage}</p>
    <a href="https://canadasoccer.com/clubs/club-directory/" target="_blank" rel="noopener noreferrer">Browse the official Canada Soccer directory <ExternalLink size={12}/></a>
   </details>
   {result.clubs.length>0&&<button className="primary" type="button" disabled={saving||!!savedWish} onClick={()=>void save()}>
    <Bookmark size={15}/> {saving?'Saving…':savedWish?'Saved under my soccer wish':'Save all '+result.clubs.length+' club entries'} <ArrowRight size={15}/>
   </button>}
   {savedWish&&<><p className="career-success">Saved! Your receipt confirms saved research, not a club registration or booked tryout.</p>
    <WorkReceipts wishId={savedWish}/>
    <button type="button" className="back" onClick={onSaved}>Open My wishes <ArrowRight size={15}/></button>
   </>}
  </div>}
 </section>;
}
