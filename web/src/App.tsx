import AuthGate from './AuthGate';
import MyWishes from './MyWishes';
import FirstWish from './FirstWish';
import JinnAvatar from './JinnAvatar';
import { getSupabase, isVerifiedAccount } from './supabaseClient';
import { listJinns, type JinnIdentity } from './jinnStore';
import { listFirstWishes } from './firstWishStore';
import {
  clearChosenJinn, lastChosenJinn, rememberChosenJinn,
  resolveAdaptiveHome, type HomeSelection,
} from './adaptiveHome';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, RotateCcw } from 'lucide-react';
import { localeLabels, supportedLocales, useLocale } from './i18n';

type Stage='wish'|'first'|'library';
type HomeAccount = {
  ownerId: string;
  status: 'ready'|'error';
  jinns: JinnIdentity[];
  wishCount: number;
  error?: string;
};
const examples=['I want to make a family story book','I want to start a garden','I want to learn a new skill'];

export default function App(){
 const {locale,setLocale,t}=useLocale();
 const languageSelector=<div className="language-picker"><label htmlFor="ui-language">{t('Language')}</label>
   <select id="ui-language" aria-label={t('Language')} value={locale}
     onChange={event=>setLocale(event.target.value as typeof locale)}>
     {supportedLocales.map(option=><option key={option} value={option}>{localeLabels[option]}</option>)}
   </select></div>;
 if(window.location.pathname.startsWith('/p/'))return <div className="app jinn-experience"><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><JinnAvatar size="tiny"/></span><span>Jinn<span className="brand-dot">.</span></span></a>{languageSelector}</header><main className="main"><section className="content entrance"><JinnAvatar size="medium"/><h2>{t('This shared page has been retired.')}</h2><p className="lead">{t('Jinn now works with private Wishes and editable Deeds.')}</p><a className="primary" href="/">{t('Start a wish')} <ArrowRight size={16}/></a></section></main></div>;
 const initialId=new URLSearchParams(window.location.search).get('wish');
 const [stage,setStage]=useState<Stage>(initialId?'first':'wish');
 const [wish,setWish]=useState('');
 const [firstWishId,setFirstWishId]=useState<string|null>(initialId);
 const [draftSelection,setDraftSelection]=useState<HomeSelection>(null);
 const [draftJinnName,setDraftJinnName]=useState<string|null>(null);
 const [homeSelection,setHomeSelection]=useState<HomeSelection>(null);
 const [rememberedId,setRememberedId]=useState<string|null>(null);
 const [home,setHome]=useState<HomeAccount|null>(null);
 const [homeRefresh,setHomeRefresh]=useState(0);
 const [account,setAccount]=useState<User|null>(null);
 const [sessionReady,setSessionReady]=useState(false);
 const [authIntent,setAuthIntent]=useState<'first'|'account'|null>(initialId?'first':null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  try{
   const client=getSupabase();
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
    if(!active)return;
    setAccount(isVerifiedAccount(session?.user??null)?session!.user:null);setSessionReady(true);
   });
   void client.auth.getUser().then(({data:{user}})=>{
    if(active){setAccount(isVerifiedAccount(user)?user:null);setSessionReady(true);}
   }).catch(()=>{if(active)setSessionReady(true);});
   return()=>{active=false;subscription.unsubscribe();};
  }catch{setSessionReady(true);return()=>{active=false;};}
 },[]);

 // Read ownership without materializing a default Jinn. A system-only default
 // must not turn a new user's guest-like experience into completed onboarding.
 useEffect(()=>{
  if(stage!=='wish'||!account){setHome(null);setRememberedId(null);return;}
  let active=true;
  const ownerId=account.id;
  setHome(null);
  setRememberedId(lastChosenJinn(ownerId));
  void Promise.all([listJinns(),listFirstWishes()]).then(([jinns,wishes])=>{
    if(active)setHome({ownerId,status:'ready',jinns,wishCount:wishes.length});
  }).catch(cause=>{
    if(active)setHome({ownerId,status:'error',jinns:[],wishCount:0,
      error:cause instanceof Error?cause.message:'Could not load your Jinns.'});
  });
  return()=>{active=false;};
 },[stage,account?.id,homeRefresh]);

 const ownerId=account?.id??null;
 const homeReady=!account||(home?.ownerId===ownerId&&home.status==='ready');
 const homeDecision=resolveAdaptiveHome(ownerId,homeReady&&home?.status==='ready'?home.jinns:[],
   homeReady&&home?.status==='ready'?home.wishCount:0,homeSelection,rememberedId);
 const activeJinn=homeDecision.selected;
 const namedHome=homeDecision.mode==='named'||homeDecision.mode==='multiple';
 const homeUnavailable=!!account&&home?.ownerId===ownerId&&home.status==='error';
 const homeBusy=!sessionReady||!!account&&!homeReady&&!homeUnavailable;

 const reset=()=>{
  window.history.replaceState(null,'',window.location.pathname);
  setStage('wish');setWish('');setFirstWishId(null);setDraftSelection(null);setDraftJinnName(null);
  setHomeSelection(null);setAuthIntent(null);setError('');
 };
 const selectHomeJinn=(jinnId:string)=>{
  if(!account||!home?.jinns.some(jinn=>jinn.id===jinnId))return;
  const choice={id:jinnId,ownerId:account.id};
  setHomeSelection(choice);setRememberedId(jinnId);
  rememberChosenJinn(account.id,jinnId);
 };
 const recoverHome=()=>{
  if(!account)return;
  clearChosenJinn(account.id);setHomeSelection(null);setRememberedId(null);
 };
 const startWishForJinn=(jinnId?:string)=>{
  reset();
  if(jinnId&&account){
    // My Jinns owns this selection. Home reload will independently validate it.
    const choice={id:jinnId,ownerId:account.id};
    setHomeSelection(choice);setRememberedId(jinnId);
    rememberChosenJinn(account.id,jinnId);
  }
 };
 const showMyWishes=()=>{
  window.history.replaceState(null,'',window.location.pathname);
  setStage('library');setAuthIntent(null);setError('');
 };
 const openWish=(id:string,aspiration:string)=>{
  setWish(aspiration);setFirstWishId(id);setDraftSelection(null);setDraftJinnName(null);setStage('first');
  const url=new URL(window.location.href);url.searchParams.set('wish',id);
  window.history.replaceState(null,'',url.pathname+url.search);
 };
 const signOut=async()=>{
  try{const {error:signOutError}=await getSupabase().auth.signOut({scope:'local'});
   if(signOutError)throw signOutError;setAccount(null);reset();}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not sign out.');}
 };
 const afterAuth=()=>{const intent=authIntent;setAuthIntent(null);if(intent==='account')setStage('library');};
 const beginWish=()=>{
  if(wish.trim().length<2||homeBusy||homeUnavailable||homeDecision.requiresRecovery)return;
  setDraftSelection(namedHome&&activeJinn&&ownerId?{id:activeJinn.id,ownerId}:null);
  setDraftJinnName(namedHome&&activeJinn?activeJinn.name:null);
  setFirstWishId(null);setStage('first');
 };
 return <div className="app jinn-experience">
  <header className="topbar"><button className="brand" onClick={()=>reset()} aria-label={t("Jinn home")}><span className="brand-mark"><JinnAvatar size="tiny"/></span><span>Jinn<span className="brand-dot">.</span></span></button>
   <div className="top-right">{languageSelector}{sessionReady&&(account?<><button type="button" className="account-link" onClick={showMyWishes}>{t('My Jinns')}</button><button type="button" className="account-link account-quiet" onClick={()=>void signOut()}>{t("Sign out")}</button></>:<button type="button" className="account-link" onClick={()=>setAuthIntent('account')}>{t("Sign in")}</button>)}</div></header>
  <main className="main" aria-live="polite"><div className="hero-glow" aria-hidden="true"/>
   {authIntent&&<AuthGate showCompanion purpose={t(authIntent==='first'?'Your draft is ready to keep.':'Your Jinns and saved wishes are here.')} onAuthenticated={afterAuth} onCancel={()=>setAuthIntent(null)}/>}
   {!authIntent&&stage==='wish'&&<section className="welcome entrance">
    <div className="welcome-copy"><p className="welcome-kicker"><span className="welcome-kicker-line"/> {t("YOUR WISH STARTS HERE")}</p>
     <h1>{t("What would you")} <em>{t("like to do?")}</em></h1><p className="welcome-lead">{t('Tell {name} what matters to you. We’ll find one useful first step together.',{name:namedHome&&activeJinn?activeJinn.name:'Jinn'})}</p>
     {homeBusy&&<p className="home-jinn-loading" role="status">{t('Opening your companions…')}</p>}
     {homeUnavailable&&<div className="home-jinn-recovery" role="alert"><p>{t('Could not load your companions.')} {t('Your Wish has not been assigned.')}</p><button type="button" className="first-secondary" onClick={()=>setHomeRefresh(value=>value+1)}><RotateCcw size={16}/> {t('Retry loading Jinns')}</button></div>}
     {!homeBusy&&!homeUnavailable&&namedHome&&<div className="home-jinn-context" aria-label={t('Current Wish companion')}>
      <JinnAvatar size="small"/>
      <div className="home-jinn-details">
       {homeDecision.mode==='multiple'?<>
        <label htmlFor="home-jinn-choice">{t('MAKE THIS WISH WITH')}</label>
        <select id="home-jinn-choice" value={activeJinn?.id||''} onChange={event=>selectHomeJinn(event.target.value)} disabled={homeDecision.requiresRecovery}>
         {!activeJinn&&<option value="">{t('Choose your Jinn')}</option>}
         {(home?.jinns||[]).map(jinn=><option key={jinn.id} value={jinn.id}>{jinn.name}{jinn.is_primary?' · '+t('Default'):''}</option>)}
        </select>
        <small>{t('The selected Jinn helps with this Wish. Your work stays in your account and this Wish keeps its own context.')}</small>
       </>:<>
        <span className="home-jinn-name">{t('Wish with {name}',{name:activeJinn?.name||'Jinn'})}</span>
        <small>{t('{name} is helping with this Wish.',{name:activeJinn?.name||'Jinn'})}</small>
       </>}
      </div>
      {account&&<button type="button" className="home-jinn-manage" onClick={showMyWishes} aria-label={t('Manage Jinns')}>{t('Manage')}</button>}
     </div>}
     {!homeBusy&&!homeUnavailable&&homeDecision.requiresRecovery&&<div className="home-jinn-recovery" role="alert">
       <p>{t('Your previously selected Jinn is no longer available for this account. No Wish has been reassigned.')}</p>
       <button type="button" className="first-secondary" onClick={recoverHome}>{t('Choose my default Jinn')}</button>
       <button type="button" className="first-secondary" onClick={showMyWishes}>{t('Open My Jinns')}</button>
     </div>}
     {!homeBusy&&!homeUnavailable&&<form className="wish-form" onSubmit={event=>{event.preventDefault();beginWish();}}>
      <label htmlFor="wish" className="field-label">{t('YOUR WISH')}</label><textarea id="wish" maxLength={280} rows={3} value={wish} onChange={event=>setWish(event.target.value)} placeholder={t('I want to…')}/>
      <button type="submit" className="primary" disabled={wish.trim().length<2||homeDecision.requiresRecovery||namedHome&&!activeJinn}>{t('Continue with {name}',{name:namedHome&&activeJinn?activeJinn.name:'Jinn'})} <ArrowRight size={18}/></button></form>}
     <p className="try-label">{t('A few places to begin')}</p><div className="chips">{examples.map(example=><button key={example} type="button" className="chip" onClick={()=>setWish(t(example))}>{t(example)}</button>)}</div>
     {error&&<p className="error" role="alert">{error}</p>}
     <p className="mini-note"><LockKeyhole size={14}/> {t(account?'You control this Wish. Saving keeps it in your account; AI only prepares a draft.':'Start without signing in. Your wish is sent to AI to prepare a private draft.')}</p></div>
    <aside className="welcome-companion" aria-label={t('Current Wish companion')}><div className="welcome-orbit"><JinnAvatar size="large"/></div>
     <p className="welcome-companion-title">{t('One wish.')}<br/><em>{t('One meaningful start.')}</em></p><p>{t('{name} helps you shape a first Deed you can inspect, edit, and keep.',{name:namedHome&&activeJinn?activeJinn.name:'Jinn'})}</p>
     <div className="welcome-progress" aria-label="Wish journey"><span className="active">01 <small>{t('Your wish')}</small></span><span>02 <small>{t('One question')}</small></span><span>03 <small>{t('First Deed')}</small></span></div></aside>
   </section>}
   {stage==='first'&&(!authIntent||!firstWishId)&&<div style={{display:authIntent?'none':'contents',width:'100%'}}><FirstWish key={firstWishId||wish} wish={wish.trim()} savedId={firstWishId}
    preferredJinnId={draftSelection?.id??null} preferredJinnOwnerId={draftSelection?.ownerId??null} preferredJinnName={draftJinnName}
    onBack={()=>firstWishId?showMyWishes():reset()} onRequireAuth={()=>setAuthIntent('first')} onDeleted={showMyWishes}
    onSaved={id=>openWish(id,wish)}/></div>}
   {!authIntent&&stage==='library'&&account&&<MyWishes email={account.email||''} ownerId={account.id} onNewWish={startWishForJinn} onOpenFirstWish={openWish}/>}
  </main><footer className="footer"><span>{t('Your wishes. Real work.')}</span><span>WISHT / BETA</span></footer>
 </div>;
}
