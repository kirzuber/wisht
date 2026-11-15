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
import FirstWish from './FirstWish';
import JinnAvatar from './JinnAvatar';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, LockKeyhole, Sparkles } from 'lucide-react';

type Mission={id:string;title:string;promise:string;question:string;choices:{id:string;label:string}[];deliverables:string[];nextInput:string;permission:string};
type Interpretation={kind:string;tone:'warm'|'playful'|'discreet';reflection:string;message:string;missions:Mission[];supported:boolean};
type Stage='wish'|'first'|'choose'|'portfolio'|'library'|'scout'|'submission'|'career-scout'|'soccer-scout';
const examples=['I want to be a photographer','I want a new career','I want to play soccer'];
const API=import.meta.env.VITE_API_BASE_URL || '';

function WishApp(){
 const [stage,setStage]=useState<Stage>(()=>new URLSearchParams(window.location.search).has('portfolio')?'portfolio':new URLSearchParams(window.location.search).has('wish')?'first':'wish');
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
 const [firstWishId,setFirstWishId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('wish'));
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
 const [authIntent,setAuthIntent]=useState<'portfolio'|'account'|'scout'|'career-scout'|'soccer-scout'|'first'|null>(
   ()=>new URLSearchParams(window.location.search).has('portfolio')?'portfolio':null
 );
 const [error,setError]=useState('');
 const reset=()=>{window.history.replaceState(null,'',window.location.pathname);setOpenedPortfolioId(null);setPortfolioWishId(null);setScoutWishId(null);setCareerWishId(null);setSoccerWishId(null);setFirstWishId(null);setScoutPreview(null);setSubmissionContext(null);setStage('wish');setWish('');setUnderstood(null);setSelected(null);setError('');setAuthIntent(null);};
 const startFirstWish=()=>{if(wish.trim().length>=2){setFirstWishId(null);setStage('first');}};
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
  if (intent === 'first') setStage('first');
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
 const experience=stage==='wish'||stage==='first'||stage==='library'||authIntent==='first'||authIntent==='account';
 return <div className={`app${experience?' jinn-experience':''}`}>
   <header className="topbar">
     <button className="brand" onClick={reset} aria-label="Jinn home"><span className="brand-mark">{experience?<JinnAvatar size="tiny"/>:<Sparkles size={18} strokeWidth={1.7}/>}</span><span>Jinn<span className="brand-dot">.</span></span></button>
     <div className="top-right">
       {sessionReady && (account ? <>
         <button type="button" className="account-link" onClick={showMyWishes}>My wishes</button>
         <button type="button" className="account-link account-quiet" onClick={()=>void signOut()}>Sign out</button>
       </> : <button type="button" className="account-link" onClick={()=>setAuthIntent('account')}>Sign in</button>)}
     </div>
   </header>
   <main className="main" aria-live="polite">
    <div className="hero-glow" aria-hidden="true"/>
    {stage==='choose' && !authIntent && <div className="hero-icon" aria-hidden="true"><Sparkles size={30} strokeWidth={1.25}/></div>}
    {authIntent && <AuthGate showCompanion={authIntent==='first'||authIntent==='account'} purpose={authIntent==='first'?'Your draft is ready to keep.':authIntent==='portfolio'?'Your portfolio is ready to begin.':authIntent==='scout'?'Your findings are ready to keep.':authIntent==='career-scout'?'Sign in for AI matching or saving.':authIntent==='soccer-scout'?'Sign in to save your soccer research.':'Sign in to see your saved work.'}
       onAuthenticated={afterAuth} onCancel={()=>setAuthIntent(null)}/>}
    {!authIntent && stage==='wish' && <section className="welcome entrance">
       <div className="welcome-copy">
         <p className="welcome-kicker"><span className="welcome-kicker-line"/> YOUR WISH STARTS HERE</p>
         <h1>What would you <em>like to do?</em></h1>
         <p className="welcome-lead">Tell Jinn what matters to you. We’ll find one useful first step together.</p>
         <form onSubmit={e=>{e.preventDefault();startFirstWish();}} className="wish-form">
           <label htmlFor="wish" className="field-label">YOUR WISH</label>
           <textarea id="wish" maxLength={280} value={wish} onChange={e=>setWish(e.target.value)}
             placeholder="I want to…" rows={3}/>
           <button type="submit" className="primary" disabled={wish.trim().length<2||busy}>
             Continue with Jinn <ArrowRight size={18}/>
           </button>
         </form>
         <p className="try-label">A few places to begin</p>
         <div className="chips">{examples.map(x=><button key={x} type="button" className="chip"
           onClick={()=>setWish(x)}>{x}<ChevronRight size={13}/></button>)}</div>
         {error&&<p className="error" role="alert">{error}</p>}
         <p className="mini-note"><LockKeyhole size={14}/> Start without signing in. Your wish is sent to AI to prepare a private draft.</p>
         <button type="button" className="back" onClick={()=>void interpret()}>Explore existing photography, career and soccer tools</button>
       </div>
       <aside className="welcome-companion" aria-label="Jinn, your wish companion">
         <div className="welcome-orbit"><JinnAvatar size="large"/></div>
         <p className="welcome-companion-title">One wish.<br/><em>One meaningful start.</em></p>
         <p>Jinn helps you shape a first Deed you can inspect, edit, and keep.</p>
         <div className="welcome-progress" aria-label="Wish journey"><span className="active">01 <small>Your wish</small></span><span>02 <small>One question</small></span><span>03 <small>First Deed</small></span></div>
       </aside>
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
    {stage==='first'&&<div style={{display:authIntent?'none':'contents',width:'100%'}}><FirstWish key={firstWishId||wish}
      wish={wish.trim()} savedId={firstWishId} onBack={()=>firstWishId?showMyWishes():reset()}
      onRequireAuth={()=>setAuthIntent('first')} onDeleted={showMyWishes} onSaved={id=>{setFirstWishId(id);const url=new URL(window.location.href);url.searchParams.set('wish',id);window.history.replaceState(null,'',url.pathname+url.search);}}/></div>}
    {!authIntent && stage==='library' && account && <MyWishes email={account.email||''} onOpenPortfolio={openPortfolio} onNewPortfolio={startAnotherPortfolio} onOpenScout={startScoutForWish} onCareerScout={startCareerScoutForWish} onSoccerScout={startSoccerScoutForWish} onPrepareSubmission={prepareSubmission} onOpenSubmission={openSubmission} onNewWish={reset}
      onOpenFirstWish={(id,aspiration)=>{setWish(aspiration);setFirstWishId(id);setStage('first');const url=new URL(window.location.href);url.searchParams.set('wish',id);window.history.replaceState(null,'',url.pathname+url.search);}}/>}
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
