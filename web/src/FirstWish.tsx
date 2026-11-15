import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { Artifact, DeedReceipt, Section } from '../../api/src/firstDeed';
import { getSupabase } from './supabaseClient';
import { deleteFirstWish, loadFirstWish, saveFirstWish, updateFirstWish, type FirstWishRow } from './firstWishStore';
import { correctSource, validateEditedArtifact } from './firstWishModel';
import { browserDiagnostic, diagnosticCode } from './browserDiagnostics';
import JinnAvatar from './JinnAvatar';

type Props={wish:string;savedId?:string|null;onBack:()=>void;onRequireAuth:()=>void;onDeleted:()=>void;onSaved:(id:string)=>void};
type Phase='clarify'|'answer'|'working'|'workspace'|'start-error';
const API=import.meta.env.VITE_API_BASE_URL||'';
const FOLLOW_UP_OPERATION='AI prepared a follow-up draft from the saved, corrected artifact';

async function endpoint(body:{mode:'clarify'|'prepare'|'continue'} & Record<string,unknown>, token?:string){
  const event = `deed.${body.mode}`;
  browserDiagnostic('info', `${event}.started`);
  let response: Response;
  try {
    response=await fetch(`${API}/api/first-deed`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  } catch {
    browserDiagnostic('error', `${event}.failed`, {code:'api_unreachable'});
    throw new Error('Could not reach the drafting service. Please try again.');
  }
  const result=await response.json().catch(()=>null);
  if(!response.ok || !result){
    browserDiagnostic('error', `${event}.failed`, {
      status:response.status, code:diagnosticCode(result?.code) ?? (result ? 'api_request_failed' : 'api_invalid_response'),
    });
    throw new Error(typeof result?.error === 'string' ? result.error : 'Could not reach the drafting service. Please try again.');
  }
  browserDiagnostic('info', `${event}.succeeded`);
  return result;
}

export default function FirstWish({wish,savedId,onBack,onRequireAuth,onDeleted,onSaved}:Props){
  const [phase,setPhase]=useState<Phase>('working');
  const [question,setQuestion]=useState<string|null>(null);
  const [answer,setAnswer]=useState('');
  const [artifact,setArtifact]=useState<Artifact|null>(null);
  const [receipt,setReceipt]=useState<DeedReceipt|null>(null);
  const [row,setRow]=useState<FirstWishRow|null>(null);
  const [dirty,setDirty]=useState(false);
  const sourceBaseline=useRef('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retryAttempt,setRetryAttempt]=useState(0);
  const currentWish=row?.aspiration||wish;
  const ru=/[\u0400-\u04ff]/u.test(currentWish);
  const label=(english:string,russian:string)=>ru?russian:english;

  useEffect(()=>{
    let live=true;
    setError('');
    setPhase('working');
    if(savedId){
      void loadFirstWish(savedId).then(saved=>{if(!live)return;setRow(saved);setArtifact(saved.first_artifact);sourceBaseline.current=saved.first_artifact.sourceNote;setReceipt(saved.first_deed);setPhase('workspace');})
        .catch(e=>{if(live){setError(e instanceof Error?e.message:'Could not load wish.');setPhase('workspace');}});
    }else{
      void endpoint({mode:'clarify',wish}).then(data=>{if(!live)return;setQuestion(data.question);setPhase(data.question?'answer':'clarify');})
        .catch(e=>{if(live){setError(e instanceof Error?e.message:'Could not begin.');setPhase('start-error');}});
    }
    return()=>{live=false;};
  },[savedId,wish,retryAttempt]);

  const prepare=async(source:string)=>{
    setBusy(true);setError('');setPhase('working');
    try{
      const result=await endpoint({mode:'prepare',wish,answer:source});
      setArtifact(result.artifact);sourceBaseline.current=result.artifact.sourceNote;setReceipt(result.receipt);setPhase('workspace');
    }catch(e){setError(e instanceof Error?e.message:'Could not prepare this deed.');setPhase(question?'answer':'clarify');}
    finally{setBusy(false);}
  };
  const save=async()=>{
    if(!artifact||!receipt)return;
    setBusy(true);setError('');
    try{
      validateEditedArtifact(artifact);
      if (!row) {
        onSaved(await saveFirstWish(wish,artifact,receipt));
        return;
      }
      const saved=await updateFirstWish(row,artifact);
      setRow(saved);setArtifact(saved.first_artifact);sourceBaseline.current=saved.first_artifact.sourceNote;setReceipt(saved.first_deed);setDirty(false);
    }catch(e){
      const message=e instanceof Error?e.message:'Could not save your wish.';
      if(e instanceof Error && e.name==='WishSignInRequired')onRequireAuth();else setError(message);
    }finally{setBusy(false);}
  };
  const continueWish=async()=>{
    if(!row||dirty)return;
    setBusy(true);setError('');
    try{
      const {data:{session},error:sessionError}=await getSupabase().auth.getSession();
      if(sessionError||!session?.access_token)throw new Error('Sign in to continue this wish.');
      const result=await endpoint({mode:'continue',wishId:row.id},session.access_token);
      const saved=await updateFirstWish(row,result.artifact,result.receipt);
      setRow(saved);setArtifact(saved.first_artifact);sourceBaseline.current=saved.first_artifact.sourceNote;setReceipt(saved.first_deed);setDirty(false);
    }catch(e){setError(e instanceof Error?e.message:'Could not continue this wish.');}
    finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!row||!window.confirm('Delete this wish and its first-deed artifact? This cannot be undone.'))return;
    setBusy(true);setError('');
    try{await deleteFirstWish(row.id);onDeleted();}
    catch(e){setError(e instanceof Error?e.message:'Could not delete this wish.');setBusy(false);}
  };
  const edit=(updated:Artifact)=>{setArtifact(updated);setDirty(true);};
  const updateSection=(index:number,section:Section)=>{
    if(!artifact)return;
    edit({...artifact,sections:artifact.sections.map((s,i)=>i===index?section:s)});
  };
  return <section className={'first-wish entrance '+(phase==='workspace'?'is-workspace':'is-conversation')} aria-live="polite">
    <div className="journey-top"><button type="button" className="first-back" onClick={onBack}><ArrowLeft size={16}/> {savedId?label('My wishes','Мои желания'):label('Back to wish','Назад')}</button><span>{label('WISH · FIRST DEED · WORKSPACE','ЖЕЛАНИЕ · ПЕРВЫЙ ШАГ · РАБОТА')}</span></div>
    <div className="first-jinn"><JinnAvatar size={phase==='workspace'?'small':'large'}/><span><strong>Jinn</strong><small>{row?label('Here with your saved wish','Здесь с вашим сохранённым желанием'):label('Here to help with this wish','Помогу с этим желанием')}</small></span></div>
    {phase==='workspace'&&artifact&&<nav className="workspace-nav" aria-label={label('Wish workspace','Работа с желанием')}>
      <a href="#wish-current">{label('Current wish','Желание')}</a><a href="#wish-artifacts">{label('Artifacts','Документы')}</a><a href="#wish-next">{label('Next step','Следующий шаг')}</a><a href="#wish-history">{label('History','История')}</a>
    </nav>}
    <p className="eyebrow">{label('YOUR WISH','ВАШЕ ЖЕЛАНИЕ')}</p><h1>{currentWish}</h1>
    {phase==='start-error'&&<div className="first-panel">
      <p className="error" role="alert">{error}</p>
      <button type="button" className="primary" onClick={()=>setRetryAttempt(attempt=>attempt+1)}>
        <RotateCcw size={16}/> {label('Retry starting wish','Попробовать снова')}
      </button>
    </div>}
    {phase==='clarify'&&!artifact&&<div className="first-panel"><p className="first-panel-kicker">{label('JINN’S STARTING POINT','НАЧАЛЬНЫЙ ШАГ JINN')}</p><p>{question||label('We can start with what you shared. I’ll prepare one useful first step.','Можно начать с того, что вы рассказали. Подготовлю один полезный первый шаг.')}</p>
      <button className="primary" disabled={busy} onClick={()=>void prepare('')}>{label('Prepare my first deed','Подготовить первый шаг')} <ArrowRight size={16}/></button>
      {error&&<p className="error" role="alert">{error}</p>}</div>}
    {phase==='answer'&&<div className="first-panel"><p className="first-panel-kicker">{label('A QUESTION FROM JINN','ВОПРОС ОТ JINN')}</p>
      <label htmlFor="first-answer">{question}</label>
      <textarea id="first-answer" rows={3} maxLength={500} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={label('A few words are enough','Достаточно нескольких слов')}/>
      <div className="first-actions"><button className="primary" disabled={busy} onClick={()=>void prepare(answer.trim())}>{label('Prepare my first deed','Подготовить первый шаг')} <ArrowRight size={16}/></button>
      <button type="button" className="first-secondary" disabled={busy} onClick={()=>void prepare('')}>{label('I’m not sure','Не знаю')}</button></div>
      {error&&<p className="error" role="alert">{error}</p>}
    </div>}
    {phase==='working'&&<div className="first-panel" role="status"><p className="first-panel-kicker"><Sparkles size={16}/> {label('JINN IS WITH YOU','JINN РЯДОМ')}</p>{savedId?label('Welcome back. Opening your saved work…','С возвращением. Открываю сохранённую работу…'):busy?label('Preparing your first Deed…','Готовлю ваш первый шаг…'):label('Finding one good place to start…','Ищу хороший первый шаг…')}</div>}
    {phase==='workspace'&&artifact&&receipt&&<>
      <div className="workspace-intro"><div><p className="eyebrow">{row?label('WELCOME BACK','С ВОЗВРАЩЕНИЕМ'):label('YOUR FIRST DEED','ВАШ ПЕРВЫЙ ШАГ')}</p><h2>{row?label('Continue your wish.','Продолжим ваше желание.'):label('Your first Deed.','Ваш первый шаг.')}</h2></div><JinnAvatar size="medium"/></div>
      <div className="first-state"><span className="first-pill">{row?label('SAVED WISH','ЖЕЛАНИЕ СОХРАНЕНО'):label('UNSAVED DRAFT','ЧЕРНОВИК НЕ СОХРАНЁН')}</span><span className="first-pill first-prepared">{label('DEED PREPARED','ПЕРВЫЙ ШАГ ПОДГОТОВЛЕН')}</span></div>
      <p className="first-intro">{row?label('Welcome back. Your Jinn has this wish and your latest corrections.','С возвращением. Jinn видит это желание и ваши последние исправления.'):label('Your first Deed is ready to inspect and edit.','Первый шаг готов: его можно просмотреть и исправить.')}</p>
      <div className="first-layout">
        <article className="first-canvas" id="wish-artifacts"><header><p className="eyebrow">{label('DRAFT · EDITABLE','ЧЕРНОВИК · МОЖНО ИЗМЕНИТЬ')}</p><h2>{artifact.title}</h2></header>
          <div className="first-source"><label htmlFor="first-source-note">{label('From you · source note','Ваши слова · исходная заметка')}</label>
            <textarea id="first-source-note" rows={2} maxLength={500} value={artifact.sourceNote} onChange={e=>edit({...artifact,sourceNote:e.target.value})}
              onBlur={()=>{if(artifact.sourceNote!==sourceBaseline.current){
                edit(correctSource({...artifact,sourceNote:sourceBaseline.current},artifact.sourceNote));
                sourceBaseline.current=artifact.sourceNote;
              }}}
              placeholder={label('No detail supplied yet. Add or correct your own facts here.','Пока нет подробностей. Добавьте или исправьте свои сведения.')}/>
            <small>{label('Only this wish uses this note. Your correction takes priority in the next Deed.','Эта заметка относится только к этому желанию. Следующий шаг учтёт ваши исправления.')}</small></div>
          {artifact.sections.map((section,index)=><div className="first-section" data-kind={section.type} key={index}>
            <label htmlFor={`section-${index}`}>{section.title}</label>
            {section.type==='document'?<textarea id={`section-${index}`} rows={Math.max(5,Math.min(20,Math.ceil(section.body.length/35)))} maxLength={2500}
              value={section.body} onChange={e=>updateSection(index,{...section,body:e.target.value})}/>:
              section.type==='checklist'?<ol>{section.items.map((item,itemIndex)=><li key={itemIndex}>
                <textarea rows={Math.max(2,Math.ceil(item.text.length/28))} maxLength={220} aria-label={`${section.title} step ${itemIndex+1}`} value={item.text}
                  onChange={e=>updateSection(index,{...section,items:section.items.map((it,i)=>i===itemIndex?{...it,text:e.target.value}:it)})}/>
                {item.dependsOn!==undefined&&<small>After step {item.dependsOn+1}</small>}
              </li>)}</ol>:
              <ol>{section.items.map((item,itemIndex)=><li key={itemIndex}><textarea rows={Math.max(2,Math.ceil(item.length/28))} maxLength={220} aria-label={`${section.title} question ${itemIndex+1}`}
                value={item} onChange={e=>updateSection(index,{...section,items:section.items.map((it,i)=>i===itemIndex?e.target.value:it)})}/></li>)}</ol>}
          </div>)}
          <div className="first-section"><label htmlFor="first-unknowns">{label('Still unknown','Пока неизвестно')}</label>
            <textarea id="first-unknowns" rows={Math.max(3,artifact.unknowns.length*2)} maxLength={1100} value={artifact.unknowns.join('\n')}
              onChange={e=>edit({...artifact,unknowns:e.target.value.split('\n').filter(Boolean)})}/></div>
          <p className="first-boundary">{artifact.boundary}</p>
        </article>
        <aside className="first-side"><div className="first-current" id="wish-current"><p className="eyebrow">{label('CURRENT WISH','ВАШЕ ЖЕЛАНИЕ')}</p><h3>{currentWish}</h3><JinnAvatar size="medium"/></div><div className="first-next" id="wish-next"><p className="eyebrow">{label('ONE NEXT DEED','СЛЕДУЮЩИЙ ШАГ')}</p><h3>{artifact.nextDeed.title}</h3>
          <p>{artifact.nextDeed.why}</p><small>{artifact.nextDeed.prompt}</small></div>
          <div className="first-receipt" id="wish-history"><p className="eyebrow">{label('HISTORY · WORK RECEIPT','ИСТОРИЯ · ЗАПИСЬ О РАБОТЕ')}</p><strong>{label('PREPARED','ПОДГОТОВЛЕНО')}</strong><p>{ru?'ИИ подготовил и проверил структуру редактируемого черновика.':receipt.operation===FOLLOW_UP_OPERATION?FOLLOW_UP_OPERATION:'AI generated and checked an editable draft against supplied facts'}</p><small>{label('Private draft only. Nothing sent, published, or independently fact-checked.','Личный черновик. Ничего не отправлено, не опубликовано и не проверено во внешних источниках.')}</small></div>
          {row&&row.deed_history.length>1&&<details className="first-history"><summary>{label('Earlier Deeds','Предыдущие шаги')} ({row.deed_history.length-1})</summary>
            <ol>{row.deed_history.slice(0,-1).map((item,index)=><li key={`${item.recordedAt}-${index}`}><strong>{label('PREPARED','ПОДГОТОВЛЕНО')}</strong><span>{ru?'Черновик подготовлен ИИ.':item.operation===FOLLOW_UP_OPERATION?FOLLOW_UP_OPERATION:'AI generated and checked an editable draft against supplied facts'}</span><time>{new Date(item.recordedAt).toLocaleString()}</time></li>)}</ol>
          </details>}
          <div className="first-privacy"><LockKeyhole size={17}/><p>{row?label('Saved privately under your account.','Сохранено только в вашем аккаунте.'):label('This draft is only in this open session until you keep it.','Черновик останется только в этой сессии, пока вы его не сохраните.')} {label('No cross-wish memory or external action.','Нет общей памяти между желаниями и внешних действий.')}</p></div>
        </aside>
      </div>
      <div className="first-footer-actions">
        <button className="primary" disabled={busy||(!dirty&&!!row)} onClick={()=>void save()}>{busy?label('Working…','Подождите…'):row?(dirty?label('Save corrections','Сохранить исправления'):label('Corrections saved','Исправления сохранены')):label('Keep this wish','Сохранить желание')} {row&&!dirty?<Check size={16}/>:<ArrowRight size={16}/>}</button>
        {row&&<button className="first-secondary" disabled={busy||dirty} onClick={()=>void continueWish()}><RotateCcw size={16}/> {label('Prepare next Deed','Подготовить следующий шаг')}</button>}
      </div>
      {dirty&&row&&<p className="first-hint">{label('Save your corrections before preparing the next Deed.','Сохраните исправления перед следующим шагом.')}</p>}
      {row&&<button className="first-delete" disabled={busy} onClick={()=>void remove()}><Trash2 size={15}/> {label('Delete wish and artifact','Удалить желание и документ')}</button>}
      {error&&<p className="error" role="alert">{error}</p>}
    </>}
    {phase==='workspace'&&!artifact&&error&&<div>
      <p className="error" role="alert">{error}</p>
      <button type="button" className="first-secondary" onClick={()=>setRetryAttempt(attempt=>attempt+1)}>
        <RotateCcw size={16}/> {label('Retry opening wish','Попробовать снова')}
      </button>
    </div>}
  </section>;
}
