import AuthGate from './AuthGate';
import MyWishes from './MyWishes';
import FirstWish from './FirstWish';
import JinnAvatar from './JinnAvatar';
import { getSupabase, isVerifiedAccount } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';

type Stage='wish'|'first'|'library';
const examples=['I want to make a family story book','I want to start a garden','I want to learn a new skill'];

export default function App(){
 if(window.location.pathname.startsWith('/p/'))return <div className="app jinn-experience"><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><JinnAvatar size="tiny"/></span><span>Jinn<span className="brand-dot">.</span></span></a></header><main className="main"><section className="content entrance"><JinnAvatar size="medium"/><h2>This shared page has been retired.</h2><p className="lead">Jinn now works with private Wishes and editable Deeds.</p><a className="primary" href="/">Start a wish <ArrowRight size={16}/></a></section></main></div>;
 const initialId=new URLSearchParams(window.location.search).get('wish');
 const [stage,setStage]=useState<Stage>(initialId?'first':'wish');
 const [wish,setWish]=useState('');
 const [firstWishId,setFirstWishId]=useState<string|null>(initialId);
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
 const reset=()=>{window.history.replaceState(null,'',window.location.pathname);setStage('wish');setWish('');setFirstWishId(null);setAuthIntent(null);setError('');};
 const showMyWishes=()=>{window.history.replaceState(null,'',window.location.pathname);setStage('library');setAuthIntent(null);setError('');};
 const openWish=(id:string,aspiration:string)=>{
  setWish(aspiration);setFirstWishId(id);setStage('first');
  const url=new URL(window.location.href);url.searchParams.set('wish',id);
  window.history.replaceState(null,'',url.pathname+url.search);
 };
 const signOut=async()=>{
  try{const {error:signOutError}=await getSupabase().auth.signOut({scope:'local'});
   if(signOutError)throw signOutError;setAccount(null);reset();}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not sign out.');}
 };
 const afterAuth=()=>{const intent=authIntent;setAuthIntent(null);if(intent==='account')setStage('library');};
 return <div className="app jinn-experience">
  <header className="topbar"><button className="brand" onClick={reset} aria-label="Jinn home"><span className="brand-mark"><JinnAvatar size="tiny"/></span><span>Jinn<span className="brand-dot">.</span></span></button>
   <div className="top-right">{sessionReady&&(account?<><button type="button" className="account-link" onClick={showMyWishes}>My wishes</button><button type="button" className="account-link account-quiet" onClick={()=>void signOut()}>Sign out</button></>:<button type="button" className="account-link" onClick={()=>setAuthIntent('account')}>Sign in</button>)}</div></header>
  <main className="main" aria-live="polite"><div className="hero-glow" aria-hidden="true"/>
   {authIntent&&<AuthGate showCompanion purpose={authIntent==='first'?'Your draft is ready to keep.':'Your saved wishes are here.'} onAuthenticated={afterAuth} onCancel={()=>setAuthIntent(null)}/>}
   {!authIntent&&stage==='wish'&&<section className="welcome entrance">
    <div className="welcome-copy"><p className="welcome-kicker"><span className="welcome-kicker-line"/> YOUR WISH STARTS HERE</p>
     <h1>What would you <em>like to do?</em></h1><p className="welcome-lead">Tell Jinn what matters to you. We’ll find one useful first step together.</p>
     <form className="wish-form" onSubmit={event=>{event.preventDefault();if(wish.trim().length>=2){setFirstWishId(null);setStage('first');}}}>
      <label htmlFor="wish" className="field-label">YOUR WISH</label><textarea id="wish" maxLength={280} rows={3} value={wish} onChange={event=>setWish(event.target.value)} placeholder="I want to…"/>
      <button type="submit" className="primary" disabled={wish.trim().length<2}>Continue with Jinn <ArrowRight size={18}/></button></form>
     <p className="try-label">A few places to begin</p><div className="chips">{examples.map(example=><button key={example} type="button" className="chip" onClick={()=>setWish(example)}>{example}</button>)}</div>
     {error&&<p className="error" role="alert">{error}</p>}
     <p className="mini-note"><LockKeyhole size={14}/> Start without signing in. Your wish is sent to AI to prepare a private draft.</p></div>
    <aside className="welcome-companion" aria-label="Jinn, your wish companion"><div className="welcome-orbit"><JinnAvatar size="large"/></div>
     <p className="welcome-companion-title">One wish.<br/><em>One meaningful start.</em></p><p>Jinn helps you shape a first Deed you can inspect, edit, and keep.</p>
     <div className="welcome-progress" aria-label="Wish journey"><span className="active">01 <small>Your wish</small></span><span>02 <small>One question</small></span><span>03 <small>First Deed</small></span></div></aside>
   </section>}
   {stage==='first'&&(!authIntent||!firstWishId)&&<div style={{display:authIntent?'none':'contents',width:'100%'}}><FirstWish key={firstWishId||wish} wish={wish.trim()} savedId={firstWishId}
    onBack={()=>firstWishId?showMyWishes():reset()} onRequireAuth={()=>setAuthIntent('first')} onDeleted={showMyWishes}
    onSaved={id=>openWish(id,wish)}/></div>}
   {!authIntent&&stage==='library'&&account&&<MyWishes email={account.email||''} onNewWish={reset} onOpenFirstWish={openWish}/>}
  </main><footer className="footer"><span>Your wishes. Real work.</span><span>WISHT / BETA</span></footer>
 </div>;
}
