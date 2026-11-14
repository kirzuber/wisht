import CareerScout from './CareerScout';
import {autoStartMission,executableMissions,firstUseRoute} from './firstUse';
import SoccerScout from './SoccerScout';
import SubmissionPrep from './SubmissionPrep';
import OpportunityScout from './OpportunityScout';
import type { ScoutResult, PhotoGenre } from './opportunityTypes';
import PublicPortfolio from './PublicPortfolio';
import AuthGate from './AuthGate';
import MyWishes from './MyWishes';
import { getAuthenticatedUser, getSupabase, isVerifiedAccount } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import PortfolioBuilder from './PortfolioBuilder';
import { saveWish, WishAlreadySavedError } from './saveWish';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Compass, LockKeyhole, RotateCcw, Sparkles, WandSparkles } from 'lucide-react';

type Mission={id:string;title:string;promise:string;question:string;choices:{id:string;label:string}[];deliverables:string[];nextInput:string;permission:string};
type Interpretation={kind:string;tone:'warm'|'playful'|'discreet';reflection:string;message:string;missions:Mission[];supported:boolean};
type Stage='wish'|'choose'|'question'|'ready'|'portfolio'|'library'|'scout'|'submission'|'career-scout'|'soccer-scout';
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
 const [answer,setAnswer]=useState('');
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
 const [saving,setSaving]=useState(false);
 const [saved,setSaved]=useState(false);
 const [duplicateWish,setDuplicateWish]=useState(false);
 const [authIntent,setAuthIntent]=useState<'save'|'portfolio'|'account'|'scout'|'career-scout'|'soccer-scout'|null>(
   ()=>new URLSearchParams(window.location.search).has('portfolio')?'portfolio':null
 );
 const [error,setError]=useState('');
 const reset=()=>{window.history.replaceState(null,'',window.location.pathname);setOpenedPortfolioId(null);setPortfolioWishId(null);setScoutWishId(null);setCareerWishId(null);setSoccerWishId(null);setScoutPreview(null);setSubmissionContext(null);setStage('wish');setWish('');setUnderstood(null);setSelected(null);setAnswer('');setError('');setSaved(false);setDuplicateWish(false);setAuthIntent(null);};
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
   if(first){setSelected(first);setAnswer('');
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
  setSelected(mission);setAnswer('');
  if(route==='portfolio'){void requireAccount('portfolio');return;}
  if(route==='scout'){startScout();return;}
  if(route==='career-scout')setCareerWishId(null);
  if(route==='soccer-scout')setSoccerWishId(null);
  setStage(route);
 };
 const save = async()=>{
  if(!understood || !selected || !answer || saving)return;
  setSaving(true);setError('');setDuplicateWish(false);
  try {
   await saveWish({aspiration:wish.trim(),kind:understood.kind,missionId:selected.id,answer});
   setSaved(true);
  } catch(e) {
   if (e instanceof WishAlreadySavedError) setDuplicateWish(true);
   setError(e instanceof Error ? e.message : 'Could not save the wish.');
  } finally { setSaving(false); }
 };
 const requireAccount = async (intent: 'save'|'portfolio') => {
  setError('');
  try {
    await getAuthenticatedUser();
    if (intent === 'portfolio') startPortfolio();
    else await save();
  } catch {
    setAuthIntent(intent);
  }
 };
 const afterAuth = () => {
  const intent = authIntent;
  setAuthIntent(null);
  if (intent === 'portfolio') startPortfolio();
  if (intent === 'save') void save();
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
 const backFromScout=()=>setStage(account?'library':'ready');
 const startCareerScout=()=>{setCareerWishId(null);setStage('career-scout');};
 const startCareerScoutForWish=(wishId:string)=>{setCareerWishId(wishId);setStage('career-scout');};
 const startSoccerScout=()=>{setSoccerWishId(null);setStage('soccer-scout');};
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
  setStage(account?'library':'wish');
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
 const currentStageIndex=stage==='wish'?0:stage==='choose'?1:stage==='question'?2:3;
 return <div className="app">
   <header className="topbar">
     <button className="brand" onClick={reset} aria-label="Jinn home"><span className="brand-mark"><Sparkles size={18} strokeWidth={1.7}/></span><span>jinn<span className="brand-dot">.</span></span></button>
     <div className="top-right">
       {sessionReady && (account ? <>
         <button type="button" className="account-link" onClick={showMyWishes}>My wishes</button>
         <button type="button" className="account-link account-quiet" onClick={()=>void signOut()}>Sign out</button>
       </> : <button type="button" className="account-link" onClick={()=>setAuthIntent('account')}>Sign in</button>)}
       <span className="dots" aria-label="Three saved wishes maximum"><i/><i/><i/></span>
     </div>
   </header>
   <main className="main" aria-live="polite">
    <div className="hero-glow" aria-hidden="true"/>
    {stage!=='portfolio' && stage!=='library' && !authIntent && <div className="hero-icon" aria-hidden="true"><Sparkles size={30} strokeWidth={1.25}/></div>}
    {authIntent && <AuthGate purpose={authIntent==='save'?'Your wish is ready to save.':authIntent==='portfolio'?'Your portfolio is ready to begin.':authIntent==='scout'?'Your findings are ready to keep.':authIntent==='career-scout'?'Sign in for AI matching or saving.':authIntent==='soccer-scout'?'Sign in to save your soccer research.':'Sign in to see your saved work.'}
       onAuthenticated={afterAuth} onCancel={()=>setAuthIntent(null)}/>}
    {!authIntent && stage==='wish' && <section className="content entrance">
      <p className="eyebrow">ONE DREAM. THREE DEEDS.</p>
      <h1>Who do you<br/><em>want to be?</em></h1>
      <p className="lead">Tell me your wish. I'll see what real work I can do to move it forward.</p>
      <form onSubmit={e=>{e.preventDefault();void interpret();}} className="wish-form">
        <label htmlFor="wish" className="field-label">MY WISH</label>
        <textarea id="wish" maxLength={280} value={wish} onChange={e=>setWish(e.target.value)} placeholder="I want to..." rows={2}/>
        <button type="submit" className="primary" disabled={wish.trim().length<2||busy}>{busy?'Looking for a way…':'Make a wish'}<ArrowRight size={18}/></button>
      </form>
      <p className="try-label">Need a little inspiration?</p>
      <div className="chips">{examples.map(x=><button key={x} type="button" className="chip" onClick={()=>setWish(x)}>{x}<ChevronRight size={13}/></button>)}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="mini-note"><LockKeyhole size={14}/> No sign-up to explore. An unrecognized wish may be sent to our configured AI model for classification.</div>
    </section>}
    {!authIntent && stage==='choose' && understood && <section className="content entrance">
      <p className="eyebrow">YOUR WISH, UNDERSTOOD</p>
      <h2>{understood.reflection}</h2>
      <p className="lead narrower">{understood.message}</p>
      {understood.supported ? <>
        <p className="field-label">CHOOSE WHAT I SHOULD WORK ON FIRST</p>
        <div className="mission-grid">{understood.missions.map((m,i)=>{
          const planned=understood.kind==='soccer' && m.id!=='find-team';
          return <button className={`mission-card${planned?' mission-card-unavailable':''}`}
            key={m.id} onClick={()=>choose(m)} disabled={planned}
            aria-label={m.title+(planned?' — coming later':' — available now')}>
            <div className="mission-number">0{i+1}</div>
            <div className="mission-body"><strong>{m.title}</strong><span>{m.promise}</span>
              {understood.kind==='soccer' && <small className="mission-availability">
                {planned?'Coming later':'Available now'}
              </small>}
            </div>
            {!planned&&<ArrowRight size={19}/>}
          </button>;
        })}</div>
        <p className="subtle">{understood.kind==='soccer'
          ? 'Find my team is ready to use. Practice plans and tryout watches are future capabilities.'
          : 'Some missions are still planned. Executable capabilities are available only where explicitly marked.'}</p>
      </>: <div className="unsupported"><Compass size={25}/><strong>My powers are still growing.</strong><p>You can try a photography, career, soccer, or independence wish. I won't claim to do something I can't.</p><button className="text-button" onClick={reset}>Try another wish <ArrowRight size={16}/></button></div>}
      <button className="back" onClick={()=>setStage('wish')}><ArrowLeft size={16}/> Change my wish</button>
    </section>}
    {!authIntent && stage==='question' && selected && <section className="content entrance">
      <p className="eyebrow">ONE SMALL THING FIRST</p>
      <h2>Let me get this<br/><em>right for you.</em></h2>
      <p className="lead narrower">{selected.question}</p>
      <div className="answers" role="group" aria-label={selected.question}>
        {selected.choices.map(x=><button key={x.id} className={`answer ${answer===x.id?'active':''}`} onClick={()=>setAnswer(x.id)}><span>{x.label}</span>{answer===x.id?<Check size={18}/>:<span className="radio"/>}</button>)}
      </div>
      <button className="primary" disabled={!answer} onClick={()=>setStage('ready')}>Shape my mission <ArrowRight size={18}/></button>
      <p className="subtle">Just one question for now. More details come only when they're needed to do the work.</p>
      <button className="back" onClick={()=>setStage('choose')}><ArrowLeft size={16}/> Choose a different deed</button>
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
       answer={answer||undefined} onBack={()=>setStage(account?'library':'ready')}
       onRequireAuth={()=>setAuthIntent('soccer-scout')} onSaved={showMyWishes}/>
     </div>}
    {stage==='career-scout' && <div style={{display:authIntent?'none':'contents',width:'100%'}}>
      <CareerScout wishId={careerWishId||undefined} aspiration={wish.trim()||undefined}
       answer={answer||undefined} onBack={()=>setStage(account?'library':'ready')}
       onRequireAuth={()=>setAuthIntent('career-scout')} onSaved={showMyWishes}/>
     </div>}
     {stage==='scout' && <div style={{display:authIntent?'none':'contents',width:'100%'}}>
      <OpportunityScout wishContext={scoutWishId
         ? {wishId:scoutWishId}
         : {aspiration:wish.trim()||undefined,missionId:'find-photo-opportunities',answer:answer||undefined}}
       initialGenre={['any','nature','portrait','open'].includes(answer)?answer as PhotoGenre:'any'}
       preview={scoutPreview} onPreview={setScoutPreview}
       onBack={backFromScout} onRequireAuth={()=>setAuthIntent('scout')} onSaved={showMyWishes}/>
    </div>}
    {!authIntent && stage==='portfolio' && <PortfolioBuilder initialId={openedPortfolioId}
      wishContext={portfolioWishId
        ? {wishId:portfolioWishId}
        : {aspiration:wish.trim() || undefined,missionId:selected?.id,answer:answer||undefined}}
      onBack={backFromPortfolio} onCreated={id=>{
      setOpenedPortfolioId(id);
      const url=new URL(window.location.href);
      url.searchParams.set('portfolio',id);
      window.history.replaceState(null,'',url.pathname+url.search);
    }}/>}
    {!authIntent && stage==='ready' && selected && <section className="content entrance">
      <p className="eyebrow">YOUR FIRST DEED</p>
      <h2>Now I know where<br/><em>to begin.</em></h2>
      <p className="lead narrower">Your mission has a clear outcome. Here's the work I would take on.</p>
      <div className="result-card">
       <div className="result-top"><span className="small-icon"><WandSparkles size={19}/></span><span className="status">MISSION DESIGNED · NOT EXECUTED</span></div>
       <h3>{selected.title}</h3>
       <p>{selected.promise}</p>
       <div className="line"/>
       <p className="section-title">WHAT I WOULD DELIVER</p>
       {selected.deliverables.map(x=><div className="deliverable" key={x}><Check size={16}/>{x}</div>)}
       <div className="line"/>
       <p className="section-title">BEFORE I CAN START</p>
       <p className="detail">{selected.nextInput}</p>
       <p className="section-title">PERMISSIONS</p>
       <p className="detail">{selected.permission}</p>
      </div>
      <div className="honesty"><LockKeyhole size={17}/><span><strong>No work has run yet.</strong> {selected.id==='build-portfolio'?'You can now build a real private gallery from photos on your device.':selected.id==='find-photo-opportunities'?'The scout can check a live public calendar. No opportunities have been checked yet.':selected.id==='career-scout'?'Jinn can search current remote job listings. No roles have been checked yet.':selected.id==='find-team'?'Jinn can check documented soccer clubs in supported Ontario cities. No clubs have been searched yet.':'This mission is planned, not executed.'} Nothing is published or charged.</span></div>
      {selected.id!=='build-portfolio' && selected.id!=='find-photo-opportunities' && selected.id!=='career-scout' && selected.id!=='find-team' && <button className="primary"
         onClick={()=>void requireAccount("save")} disabled={saving||saved}>
         {saved?'Wish saved privately':saving?'Saving…':'Save this wish'} <ArrowRight size={18}/>
      </button>}
      {error&&<p className="error" role="alert">{error}</p>}
      {(saved || duplicateWish) && <button className="back" type="button" onClick={showMyWishes}>Open My wishes <ArrowRight size={16}/></button>}
      <p className="subtle">{selected.id==='build-portfolio'
        ? 'Your photography wish is saved automatically when your first gallery is created.'
        : selected.id==='find-photo-opportunities'
        ? 'Search without an account. Your wish is saved only when you choose to keep a real shortlist.'
        : selected.id==='career-scout'?'Browse remote jobs freely. Your wish is saved only when you keep findings.':selected.id==='find-team'?'Browse Ontario clubs without an account. Your wish is saved only when you keep the research.':'Saving requires a verified email account. Exploring your wish does not require registration.'}</p>
      {selected.id==='build-portfolio'
       ? <button type="button" className="primary" onClick={()=>void requireAccount('portfolio')}>Build my private portfolio <ArrowRight size={18}/></button>
       : selected.id==='find-photo-opportunities'
        ? <button type="button" className="primary" onClick={startScout}>Find real opportunities <ArrowRight size={18}/></button>
        : selected.id==='career-scout'
         ? <button type="button" className="primary" onClick={startCareerScout}>Find real remote jobs <ArrowRight size={18}/></button>
        : selected.id==='find-team'
         ? <button type="button" className="primary" onClick={startSoccerScout}>Find local soccer clubs <ArrowRight size={18}/></button>
        : <button className="primary muted" disabled>Execute this mission <span className="coming">NEXT STORY</span></button>}
      <button className="back" onClick={reset}><RotateCcw size={16}/> Try another wish</button>
    </section>}
   </main>
   <footer className="footer"><span>Three wishes. Real work.</span><div className="step-dots" aria-label={`Experience step ${currentStageIndex+1} of 4`}>{[0,1,2,3].map(i=><span key={i} className={i===currentStageIndex?'on':''}/>)}</div><span>WISHT / BETA</span></footer>
 </div>;
}
function App(){
 const match=window.location.pathname.match(/^\/p\/([a-f0-9]{16})\/?$/);
 return match?<PublicPortfolio slug={match[1]}/>:<WishApp/>;
}
export default App;
