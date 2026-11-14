import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Compass, LockKeyhole, RotateCcw, Sparkles, WandSparkles } from 'lucide-react';

type Mission={id:string;title:string;promise:string;question:string;choices:{id:string;label:string}[];deliverables:string[];nextInput:string;permission:string};
type Interpretation={kind:string;tone:'warm'|'playful'|'discreet';reflection:string;message:string;missions:Mission[];supported:boolean};
type Stage='wish'|'choose'|'question'|'ready';
const examples=['I want to be a photographer','I want a new career','I want to play soccer','I want to be independent'];
const API=import.meta.env.VITE_API_BASE_URL || '';

function App(){
 const [stage,setStage]=useState<Stage>('wish');
 const [wish,setWish]=useState('');
 const [understood,setUnderstood]=useState<Interpretation|null>(null);
 const [selected,setSelected]=useState<Mission|null>(null);
 const [answer,setAnswer]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const reset=()=>{setStage('wish');setWish('');setUnderstood(null);setSelected(null);setAnswer('');setError('');};
 const interpret=async()=>{
  if(wish.trim().length<2)return;
  setBusy(true);setError('');
  try{
   const resp=await fetch(`${API}/api/interpret`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wish:wish.trim()})});
   const data=await resp.json();
   if(!resp.ok)throw new Error(data.error||'Something went wrong.');
   setUnderstood(data.interpretation as Interpretation);setStage('choose');
  }catch(e){setError(e instanceof Error?e.message:'Could not reach the local API. Run npm run dev.');}
  finally{setBusy(false);}
 };
 const choose=(mission:Mission)=>{setSelected(mission);setAnswer('');setStage('question');};
 const currentStageIndex=stage==='wish'?0:stage==='choose'?1:stage==='question'?2:3;
 return <div className="app">
   <header className="topbar">
     <button className="brand" onClick={reset} aria-label="Jinn home"><span className="brand-mark"><Sparkles size={18} strokeWidth={1.7}/></span><span>jinn<span className="brand-dot">.</span></span></button>
     <div className="top-right"><span className="prototype-tag">EXPERIENCE PROTOTYPE</span><span className="dots" aria-label="Three starter wishes available"><i/><i/><i/></span></div>
   </header>
   <main className="main" aria-live="polite">
    <div className="hero-glow" aria-hidden="true"/>
    <div className="hero-icon" aria-hidden="true"><Sparkles size={30} strokeWidth={1.25}/></div>
    {stage==='wish' && <section className="content entrance">
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
      <div className="mini-note"><LockKeyhole size={14}/> No sign-up. No connected accounts. Nothing is saved yet.</div>
    </section>}
    {stage==='choose' && understood && <section className="content entrance">
      <p className="eyebrow">YOUR WISH, UNDERSTOOD</p>
      <h2>{understood.reflection}</h2>
      <p className="lead narrower">{understood.message}</p>
      {understood.supported ? <>
        <p className="field-label">CHOOSE WHAT I SHOULD WORK ON FIRST</p>
        <div className="mission-grid">{understood.missions.map((m,i)=><button className="mission-card" key={m.id} onClick={()=>choose(m)}><div className="mission-number">0{i+1}</div><div className="mission-body"><strong>{m.title}</strong><span>{m.promise}</span></div><ArrowRight size={19}/></button>)}</div>
        <p className="subtle">These are planned missions. In this first story, we're choosing the right work—not executing it yet.</p>
      </>: <div className="unsupported"><Compass size={25}/><strong>My powers are still growing.</strong><p>You can try a photography, career, soccer, or independence wish. I won't claim to do something I can't.</p><button className="text-button" onClick={reset}>Try another wish <ArrowRight size={16}/></button></div>}
      <button className="back" onClick={()=>setStage('wish')}><ArrowLeft size={16}/> Change my wish</button>
    </section>}
    {stage==='question' && selected && <section className="content entrance">
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
    {stage==='ready' && selected && <section className="content entrance">
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
      <div className="honesty"><LockKeyhole size={17}/><span><strong>Nothing was run, sent, published or charged.</strong> This is JINN-001: mission planning. Real action execution and Work Receipts come in JINN-002/003.</span></div>
      <button className="primary muted" disabled>Execute this mission <span className="coming">NEXT STORY</span></button>
      <button className="back" onClick={reset}><RotateCcw size={16}/> Try another wish</button>
    </section>}
   </main>
   <footer className="footer"><span>Three wishes. Real work.</span><div className="step-dots" aria-label={`Experience step ${currentStageIndex+1} of 4`}>{[0,1,2,3].map(i=><span key={i} className={i===currentStageIndex?'on':''}/>)}</div><span>JINN-001 / LOCAL</span></footer>
 </div>;
}
export default App;
