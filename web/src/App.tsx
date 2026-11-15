import CareerScout from './CareerScout';
import {autoStartMission,executableMissions,firstUseRoute} from './firstUse';
import SoccerScout from './SoccerScout';
import SubmissionPrep from './SubmissionPrep';
import OpportunityScout from './OpportunityScout';
import type { ScoutResult } from './opportunityTypes';
import PublicPortfolio from './PublicPortfolio';
import AuthGate from './AuthGate';
import MyWishes from './MyWishes';
import { getAuthenticatedUser, getSupabase, isVerifiedAccount } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import PortfolioBuilder from './PortfolioBuilder';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, LockKeyhole, Sparkles } from 'lucide-react';

type Mission={id:string;title:string;promise:string;question:string;choices:{id:string;label:string}[];deliverables:string[];nextInput:string;permission:string};
type Interpretation={kind:string;tone:'warm'|'playful'|'discreet';reflection:string;message:string;missions:Mission[];supported:boolean};
type Stage='wish'|'choose'|'portfolio'|'library'|'scout'|'submission'|'career-scout'|'soccer-scout';
const examples=['I want to be a photographer','I want a new career','I want to play soccer'];
const API=import.meta.env.VITE_API_BASE_URL || '';

function WishApp(){
 const [stage,setStage]=useState<Stage>(()=>new URLSearchParams(window.location.search).has('portfolio')?'portfolio':'wish');
 const [openedPortfolioId,setOpenedPortfolioId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('portfolio'));
 const [portfolioWishId,setPortfolioWishId]=useState<string|null>(null);
 const [scoutWishId,setScoutWishId]=useState<string|null>(null);
 const [careerWishId,setCareerWishId]=useState<string|null>(null);
 const [soccerWishId,setSoccerWishId]=useState<string|null>(null);
 const [scoutPreview,setScoutPreview]=useState<ScoutResult|null>(null);
 const [submissionContext,setSubmissionContext]=useState<{
   wishId:string;shortlistId?:string;opportunityId?:string;existingId?:string
 }|null>(null);
 const [wish,setWish]=useState('');
 const [understood,setUnderstood]=useState<Interpretation|null>(null);
 const [selected,setSelected]=useState<Mission|null>(null);
 const [busy,setBusy]=useState(false);
 const [account,setAccount]=useState<User|null>(null);
 const [sessionReady,setSessionReady]=useState(false);

 // Supabase persists and refreshes sessions automatically; subscribe to changes for the UI.
 useEffect(()=>{
  let active=true;
  try {
   const client=getSupabase();
   const { data: { subscription } } = client.auth.onAuthStateChange((_event,session)=>{
    if(!active)return;
    const user=session?.user??null;
    setAccount(isVerifiedAccount(user)?user:null);
    setSessionReady(true);
   });
   void client.auth.getUser().then(({data:{user}})=>{
    if(active){setAccount(isVerifiedAccount(user)?user:null);setSessionReady(true);}
   }).catch(()=>{if(active)setSessionReady(true);});
   return ()=>{active=false;subscription.unsubscribe();};
  } catch {
   // Free wish discovery must still work without configured persistence.
   setSessionReady(true);
   return ()=>{active=false;};
  }
 },[]);
 const [authIntent,setAuthIntent]=useState<'portfolio'|'account'|'scout'|'career-scout'|'soccer-scout'|null>(
   ()=>new URLSearchParams(window.location.search).has('portfolio')?'portfolio':null
 );
 const [error,setError]=useState('');
 const reset=()=>{window.history.replaceState(null,'',window.location.pathname);setOpenedPortfolioId(null);setPortfolioWishId(null);setScoutWishId(null);setCareerWishId(null);setSoccerWishId(null);setScoutPreview(null);setSubmissionContext(null);setStage('wish');setWish('');setUnderstood(null);setSelected(null);setError('');setAuthIntent(null);};
 const interpret=async()=>{
  if(wish.trim().length<2)return;
  setBusy(true);setError('');
  try{
   const resp=await fetch(`${API}/api/interpret`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wish:wish.trim()})});
   const data=await resp.json();
   if(!resp.ok)throw new Error(data.error||'Something went wrong.');
   const interpretation=data.interpretation as Interpretation;
   setUnderstood(interpretation);
   const first=autoStartMission(interpretation.missions||[]);
   setSelected(first);
   if(first){
    const route=firstUseRoute(first.id);
    if(route==='career-scout')setCareerWishId(null);
    if(route==='soccer-scout')setSoccerWishId(null);
    setStage(route??'choose');
   }else setStage('choose');
  }catch(e){setError(e instanceof Error?e.message:'Could not reach the local API. Run npm run dev.');}
  finally{setBusy(false);}
 };
 const choose=(mission:Mission)=>{
  const route=firstUseRoute(mission.id);
  if(!route)return;
  setSelected(mission);
  if(route==='portfolio'){void requireAccount();return;}
  if(route==='scout'){startScout();return;}
  if(route==='career-scout')setCareerWishId(null);
  if(route==='soccer-scout')setSoccerWishId(null);
  setStage(route);
 };
 const requireAccount=async()=>{
  setError('');
  try{await getAuthenticatedUser();startPortfolio();}
  catch{setAuthIntent('portfolio');}
 };
 const afterAuth = () => {
  const intent = authIntent;
  setAuthIntent(null);
  if (intent === 'portfolio') startPortfolio();
  if (intent === 'account') setStage('library');
  if (intent === 'scout') setStage('scout');
  if (intent === 'career-scout') setStage('career-scout');
  if (intent === 'soccer-scout') setStage('soccer-scout');
 };
 const startScout=()=>{
   setScoutWishId(null);setScoutPreview(null);setStage('scout');
 };
 const startScoutForWish=(wishId:string)=>{
   setScoutWishId(wishId);setScoutPreview(null);setStage('scout');
 };
 const backFromScout=()=>setStage(scoutWishId?'library':'choose');
 const startCareerScoutForWish=(wishId:string)=>{setCareerWishId(wishId);setStage('career-scout');};
 const startSoccerScoutForWish=(wishId:string)=>{setSoccerWishId(wishId);setStage('soccer-scout');};
 const prepareSubmission=(wishId:string,shortlistId:string,opportunityId:string)=>{
   setSubmissionContext({wishId,shortlistId,opportunityId});
   setStage('submission');
 };
 const openSubmission=(wishId:string,existingId:string)=>{
   setSubmissionContext({wishId,existingId});
   setStage('submission');
 };
 const startPortfolio=()=>{
  setOpenedPortfolioId(null);setPortfolioWishId(null);
  window.history.replaceState(null,'',window.location.pathname);
  setStage('portfolio');
 };
 const startAnotherPortfolio=(wishId:string)=>{
  setOpenedPortfolioId(null);setPortfolioWishId(wishId);
  window.history.replaceState(null,'',window.location.pathname);
  setStage('portfolio');
 };
 const openPortfolio=(id:string)=>{
  setOpenedPortfolioId(id);setPortfolioWishId(null);setAuthIntent(null);setStage('portfolio');
  const url=new URL(window.location.href);
  url.searchParams.set('portfolio',id);
  window.history.replaceState(null,'',url.pathname+url.search);
 };
 const backFromPortfolio=()=>{
  window.history.replaceState(null,'',window.location.pathname);
  setOpenedPortfolioId(null);
  setStage(understood?.kind==='photography'?'choose':account?'library':'wish');
 };
 const showMyWishes=()=>{
  // Navigating inside the app should not leave an old portfolio bookmark in the URL.
  window.history.replaceState(null,'',window.location.pathname);
  setOpenedPortfolioId(null);
  setAuthIntent(null);
  setStage('library');
 };
 const signOut=async()=>{
  try {
   const {error:signOutError}=await getSupabase().auth.signOut({scope:'local'});
   if(signOutError)throw signOutError;
   setAccount(null);reset();
  } catch(cause) {setError(cause instanceof Error?cause.message:'Could not sign out.');}
 };
 return <div className="app">
   <header className="topbar">
     <button className="brand" onClick={reset} aria-label="Jinn home"><span className="brand-mark"><Sparkles size={18} strokeWidth={1.7}/></span><span>jinn<span className="brand-dot">.</span></span></button>
     <div className="top-right">
       {sessionReady && (account ? <>
         <button type="button" className="account-link" onClick={showMyWishes}>My wishes</button>
         <button type="button" className="account-link account-quiet" onClick={()=>void signOut()}>Sign out</button>
       </> : <button type="button" className="account-link" onClick={()=>setAuthIntent('account')}>Sign in</button>)}
     </div>
   </header>
   <main className="main" aria-live="polite">
    <div className="hero-glow" aria-hidden="true"/>
    {(stage==='wish'||stage==='choose') && !authIntent && <div className="hero-icon" aria-hidden="true"><Sparkles size={30} strokeWidth={1.25}/></div>}
    {authIntent && <AuthGate purpose={authIntent==='portfolio'?'Your portfolio is ready to begin.':authIntent==='scout'?'Your findings are ready to keep.':authIntent==='career-scout'?'Sign in for AI matching or saving.':authIntent==='soccer-scout'?'Sign in to save your soccer research.':'Sign in to see your saved work.'}
       onAuthenticated={afterAuth} onCancel={()=>setAuthIntent(null)}/>}
    {!authIntent && stage==='wish' && <section className="content entrance">
       <h1>Make a <em>wish.</em></h1>
       <p className="lead">What would you like to make happen?</p>
       <form onSubmit={e=>{e.preventDefault();void interpret();}} className="wish-form">
         <label htmlFor="wish" className="field-label">YOUR WISH</label>
         <textarea id="wish" maxLength={280} value={wish} onChange={e=>setWish(e.target.value)}
           placeholder="I want to…" rows={2}/>
         <button type="submit" className="primary" disabled={wish.trim().length<2||busy}>
           {busy?'Finding a way to help…':'Make my wish'} <ArrowRight size={18}/>
         </button>
       </form>
       <p className="try-label">Or try an idea</p>
       <div className="chips">{examples.map(x=><button key={x} type="button" className="chip"
         onClick={()=>setWish(x)}>{x}<ChevronRight size={13}/></button>)}</div>
       {error&&<p className="error" role="alert">{error}</p>}
       <p className="mini-note"><LockKeyhole size={14}/> Explore without signing in. Unfamiliar wishes may use AI classification.</p>
     </section>}
     {!authIntent && stage==='choose' && understood && <section className="content entrance">
      {executableMissions(understood.missions).length>0 ? <>
        <p className="eyebrow">A PLACE TO START</p>
        <h2>Here's what I can do.</h2>
        <p className="lead narrower">What would help you most right now?</p>
        <div className="mission-grid">{executableMissions(understood.missions).map(m=>
          <button type="button" className="mission-card" key={m.id} onClick={()=>choose(m)}>
            <span className="mission-body"><strong>{m.title}</strong><span>{m.promise}</span></span>
            <ArrowRight size={19}/>
          </button>
        )}</div>
      </> : <>
        <p className="eyebrow">I HEAR YOUR WISH</p>
        <h2>{understood.reflection}</h2>
        <p className="lead narrower">I can't take a reliable step toward that yet. You can try a photography, career or soccer wish instead.</p>
      </>}
      <button type="button" className="back" onClick={reset}><ArrowLeft size={16}/> Try another wish</button>
    </section>}
    {!authIntent && stage==='library' && account && <MyWishes email={account.email||''} onOpenPortfolio={openPortfolio} onNewPortfolio={startAnotherPortfolio} onOpenScout={startScoutForWish} onCareerScout={startCareerScoutForWish} onSoccerScout={startSoccerScoutForWish} onPrepareSubmission={prepareSubmission} onOpenSubmission={openSubmission} onNewWish={reset}/>}
    {!authIntent && stage==='submission' && submissionContext && <SubmissionPrep
      wishId={submissionContext.wishId}
      shortlistId={submissionContext.shortlistId}
      opportunityId={submissionContext.opportunityId}
      existingId={submissionContext.existingId}
      onBack={showMyWishes}
      onBuildPortfolio={startAnotherPortfolio}
      onSaved={showMyWishes}/>}
    {stage==='soccer-scout' && <div style={{display:authIntent?'none':'contents',width:'100%'}}>
      <SoccerScout wishId={soccerWishId||undefined} aspiration={wish.trim()||undefined}
       onBack={()=>setStage(soccerWishId?'library':'wish')}
       onRequireAuth={()=>setAuthIntent('soccer-scout')} onSaved={showMyWishes}/>
     </div>}
    {stage==='career-scout' && <div style={{display:authIntent?'none':'contents',width:'100%'}}>
      <CareerScout wishId={careerWishId||undefined} aspiration={wish.trim()||undefined}
       onBack={()=>setStage(careerWishId?'library':'wish')}
       onRequireAuth={()=>setAuthIntent('career-scout')} onSaved={showMyWishes}/>
     </div>}
     {stage==='scout' && <div style={{display:authIntent?'none':'contents',width:'100%'}}>
      <OpportunityScout wishContext={scoutWishId
         ? {wishId:scoutWishId}
         : {aspiration:wish.trim()||undefined,missionId:'find-photo-opportunities'}}
       initialGenre="any"
       preview={scoutPreview} onPreview={setScoutPreview}
       onBack={backFromScout} onRequireAuth={()=>setAuthIntent('scout')} onSaved={showMyWishes}
       onPrepareSubmission={prepareSubmission}/>
    </div>}
    {!authIntent && stage==='portfolio' && <PortfolioBuilder initialId={openedPortfolioId}
      wishContext={portfolioWishId
        ? {wishId:portfolioWishId}
        : {aspiration:wish.trim() || undefined,missionId:selected?.id}}
      onBack={backFromPortfolio} onFindOpportunities={startScoutForWish} onCreated={id=>{
      setOpenedPortfolioId(id);
      const url=new URL(window.location.href);
      url.searchParams.set('portfolio',id);
      window.history.replaceState(null,'',url.pathname+url.search);
    }}/>}
    </main>
   <footer className="footer"><span>Three wishes. Real work.</span><span>WISHT / BETA</span></footer>
 </div>;
}
function App(){
 const match=window.location.pathname.match(/^\/p\/([a-f0-9]{16})\/?$/);
 return match?<PublicPortfolio slug={match[1]}/>:<WishApp/>;
}
export default App;
