import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { Artifact, DeedReceipt, Section } from '../../api/src/firstDeed';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { listJinns, type JinnIdentity } from './jinnStore';
import { deleteFirstWish, loadFirstWish, saveFirstWish, updateFirstWish, type FirstWishRow } from './firstWishStore';
import { correctSource, validateEditedArtifact } from './firstWishModel';
import { browserDiagnostic, diagnosticCode } from './browserDiagnostics';
import JinnAvatar from './JinnAvatar';
import { formatLocalDateTime, localizeError, useLocale, type Locale } from './i18n';

type Props={wish:string;savedId?:string|null;preferredJinnId?:string|null;preferredJinnOwnerId?:string|null;preferredJinnName?:string|null;onBack:()=>void;onRequireAuth:()=>void;onDeleted:()=>void;onSaved:(id:string)=>void};
type Phase='clarify'|'answer'|'working'|'workspace'|'start-error';
const API=import.meta.env.VITE_API_BASE_URL||'';
const FOLLOW_UP_OPERATION='AI prepared a follow-up draft from the saved, corrected artifact';

async function endpoint(body:{mode:'clarify'|'prepare'|'continue'} & Record<string,unknown>, locale:Locale, token?:string){
  const event = `deed.${body.mode}`;
  browserDiagnostic('info', `${event}.started`);
  let response: Response;
  try {
    response=await fetch(`${API}/api/first-deed`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({...body,locale})});
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

export default function FirstWish({wish,savedId,preferredJinnId,preferredJinnOwnerId,preferredJinnName,onBack,onRequireAuth,onDeleted,onSaved}:Props){
  const {locale,t}=useLocale();
  const [phase,setPhase]=useState<Phase>('working');
  const [question,setQuestion]=useState<string|null>(null);
  const [answer,setAnswer]=useState('');
  const [artifact,setArtifact]=useState<Artifact|null>(null);
  const [receipt,setReceipt]=useState<DeedReceipt|null>(null);
  const [row,setRow]=useState<FirstWishRow|null>(null);
  const [jinnChoices,setJinnChoices]=useState<JinnIdentity[]>([]);
  const [saveJinnId,setSaveJinnId]=useState<string>(preferredJinnId||'');
  const [jinnUnavailable,setJinnUnavailable]=useState(false);
  const [jinnValidated,setJinnValidated]=useState(!preferredJinnId);
  const [dirty,setDirty]=useState(false);
  const sourceBaseline=useRef('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retryAttempt,setRetryAttempt]=useState(0);
  const currentWish=row?.aspiration||wish;
  const companionName=row?.jinn_name||jinnChoices.find(jinn=>jinn.id===saveJinnId)?.name||preferredJinnName||'Jinn';
  const label=(english:string,_russian:string)=>t(english);
  const receiptDescription=(item:DeedReceipt)=>{
    if(item.draftSource==='worksheet') return label(
      'Jinn prepared a starter worksheet. Fill in what you know and leave the rest open.',
      'Jinn подготовил рабочий лист. Запишите то, что Вы знаете, и оставьте остальное открытым.',
    );
    if(item.draftSource==='repaired_model') return label(
      'AI revised the draft and checked it against your supplied facts.',
      'ИИ исправил черновик и сверил его с предоставленными Вами фактами.',
    );
    return label(
      item.operation===FOLLOW_UP_OPERATION?FOLLOW_UP_OPERATION:'AI generated and checked an editable draft against supplied facts',
      'ИИ подготовил и проверил редактируемый черновик.',
    );
  };

  useEffect(()=>{
    let live=true;
    let sequence=0;
    let scheduled: ReturnType<typeof setTimeout>|undefined;
    // Selecting a Jinn changes assignment only, never the Wish's source context.
    const load=()=>{
      const current=++sequence;
      setJinnValidated(!preferredJinnId);
      void Promise.all([listJinns(),getAuthenticatedUser()]).then(([items,owner])=>{
        if(!live||current!==sequence)return;
        setJinnChoices(items);
        const wrongOwner=!!preferredJinnOwnerId&&preferredJinnOwnerId!==owner.id&&saveJinnId===preferredJinnId;
        const missingChoice=!!saveJinnId&&!items.some(item=>item.id===saveJinnId);
        setJinnUnavailable(wrongOwner||missingChoice);
        setJinnValidated(true);
      }).catch(()=>{
        if(live&&current===sequence){
          setJinnChoices([]);
          // An explicitly selected Jinn must never degrade silently into default.
          setJinnUnavailable(!!saveJinnId);
          setJinnValidated(!saveJinnId);
        }
      });
    };
    // Defer auth API calls outside Supabase's auth-state callback/lock.
    const {data:{subscription}}=getSupabase().auth.onAuthStateChange(()=>{
      if(scheduled)clearTimeout(scheduled);
      scheduled=setTimeout(load,0);
    });
    load();
    return()=>{live=false;sequence++;if(scheduled)clearTimeout(scheduled);subscription.unsubscribe();};
  },[preferredJinnId,preferredJinnOwnerId,saveJinnId]);

  useEffect(()=>{
    let live=true;
    setError('');
    setPhase('working');
    if(savedId){
      void loadFirstWish(savedId).then(saved=>{if(!live)return;setRow(saved);setArtifact(saved.first_artifact);sourceBaseline.current=saved.first_artifact.sourceNote;setReceipt(saved.first_deed);setPhase('workspace');})
        .catch(e=>{if(live){setError(localizeError(e,locale,'Could not load wish.'));setPhase('workspace');}});
    }else{
      void endpoint({mode:'clarify',wish},locale).then(data=>{if(!live)return;setQuestion(data.question);setPhase(data.question?'answer':'clarify');})
        .catch(e=>{if(live){setError(localizeError(e,locale,'Could not begin.'));setPhase('start-error');}});
    }
    return()=>{live=false;};
  },[savedId,wish,retryAttempt]);

  const prepare=async(source:string)=>{
    setBusy(true);setError('');setPhase('working');
    try{
      const result=await endpoint({mode:'prepare',wish,answer:source},locale);
      setArtifact(result.artifact);sourceBaseline.current=result.artifact.sourceNote;setReceipt(result.receipt);setPhase('workspace');
    }catch(e){setError(localizeError(e,locale,'Could not prepare this deed.'));setPhase(question?'answer':'clarify');}
    finally{setBusy(false);}
  };
  const save=async()=>{
    if(!artifact||!receipt)return;
    setBusy(true);setError('');
    try{
      validateEditedArtifact(artifact);
      if (!row) {
        const owner=await getAuthenticatedUser();
        // A different signed-in user must actively choose recovery; no implicit
        // reassignment of the initial draft to that user's default companion.
        if(preferredJinnOwnerId&&preferredJinnOwnerId!==owner.id&&saveJinnId===preferredJinnId)
          throw new Error('This Jinn belongs to a different account. Choose your default Jinn or return to My Jinns.');
        if(saveJinnId){
          const owned=await listJinns();
          if(!owned.some(jinn=>jinn.id===saveJinnId)){
            setJinnUnavailable(true);
            throw new Error('Your selected Jinn is unavailable. Choose a Jinn from this account before saving.');
          }
        }
        onSaved(await saveFirstWish(wish,artifact,receipt,saveJinnId||undefined));
        return;
      }
      const saved=await updateFirstWish(row,artifact);
      setRow(saved);setArtifact(saved.first_artifact);sourceBaseline.current=saved.first_artifact.sourceNote;setReceipt(saved.first_deed);setDirty(false);
    }catch(e){
      if(e instanceof Error && e.name==='WishSignInRequired')onRequireAuth();else setError(localizeError(e,locale,'Could not save your wish.'));
    }finally{setBusy(false);}
  };
  const continueWish=async()=>{
    if(!row||dirty)return;
    setBusy(true);setError('');
    try{
      const {data:{session},error:sessionError}=await getSupabase().auth.getSession();
      if(sessionError||!session?.access_token)throw new Error('Sign in to continue this wish.');
      const result=await endpoint({mode:'continue',wishId:row.id},locale,session.access_token);
      const saved=await updateFirstWish(row,result.artifact,result.receipt);
      setRow(saved);setArtifact(saved.first_artifact);sourceBaseline.current=saved.first_artifact.sourceNote;setReceipt(saved.first_deed);setDirty(false);
    }catch(e){setError(localizeError(e,locale,'Could not continue this wish.'));}
    finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!row||!window.confirm(t('Delete this wish and its first-deed artifact? This cannot be undone.')))return;
    setBusy(true);setError('');
    try{await deleteFirstWish(row.id);onDeleted();}
    catch(e){setError(localizeError(e,locale,'Could not delete this wish.'));setBusy(false);}
  };
  const edit=(updated:Artifact)=>{setArtifact(updated);setDirty(true);};
  const updateSection=(index:number,section:Section)=>{
    if(!artifact)return;
    edit({...artifact,sections:artifact.sections.map((s,i)=>i===index?section:s)});
  };
  return <section className={'first-wish entrance '+(phase==='workspace'?'is-workspace':'is-conversation')} aria-live="polite">
    <div className="journey-top"><button type="button" className="first-back" onClick={onBack}><ArrowLeft size={16}/> {savedId?label('My Jinns','Мои Jinn'):label('Back to wish','Назад')}</button><span>{label('WISH · FIRST DEED · WORKSPACE','ЖЕЛАНИЕ · ПЕРВЫЙ ШАГ · РАБОТА')}</span></div>
    <div className="first-jinn"><JinnAvatar size={phase==='workspace'?'small':'large'}/><span><strong>{companionName}</strong><small>{row?label('Currently assigned to this Wish · Wish-local context','Сейчас помогает с этим желанием · отдельный контекст'):label('Making this Wish with you · Wish-local context','Помогу с этим желанием · отдельный контекст')}</small></span>
      {row&&<button type="button" className="first-jinn-switch" onClick={onBack}>{label('Switch Jinn / My Jinns','Сменить Jinn / Мои Jinn')}</button>}</div>
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
    {phase==='clarify'&&!artifact&&<div className="first-panel"><p className="first-panel-kicker">{t('{name}’s starting point',{name:companionName})}</p><p>{question||label('We can start with what you shared. I’ll prepare one useful first step.','Можно начать с того, что вы рассказали. Подготовлю один полезный первый шаг.')}</p>
      <button className="primary" disabled={busy} onClick={()=>void prepare('')}>{label('Prepare my first deed','Подготовить первый шаг')} <ArrowRight size={16}/></button>
      {error&&<p className="error" role="alert">{error}</p>}</div>}
    {phase==='answer'&&<div className="first-panel"><p className="first-panel-kicker">{t('A question from {name}',{name:companionName})}</p>
      <label htmlFor="first-answer">{question}</label>
      <textarea id="first-answer" rows={3} maxLength={500} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={label('A few words are enough','Достаточно нескольких слов')}/>
      <div className="first-actions"><button className="primary" disabled={busy} onClick={()=>void prepare(answer.trim())}>{label('Prepare my first deed','Подготовить первый шаг')} <ArrowRight size={16}/></button>
      <button type="button" className="first-secondary" disabled={busy} onClick={()=>void prepare('')}>{label('I’m not sure','Не знаю')}</button></div>
      {error&&<p className="error" role="alert">{error}</p>}
    </div>}
    {phase==='working'&&<div className="first-panel" role="status"><p className="first-panel-kicker"><Sparkles size={16}/> {t('{name} is with you',{name:companionName})}</p>{savedId?label('Welcome back. Opening your saved work…','С возвращением. Открываю сохранённую работу…'):busy?label('Preparing your first Deed…','Готовлю ваш первый шаг…'):label('Finding one good place to start…','Ищу хороший первый шаг…')}</div>}
    {phase==='workspace'&&artifact&&receipt&&<>
      <div className="workspace-intro"><div><p className="eyebrow">{row?label('WELCOME BACK','С ВОЗВРАЩЕНИЕМ'):label('YOUR FIRST DEED','ВАШ ПЕРВЫЙ ШАГ')}</p><h2>{row?label('Continue your wish.','Продолжим ваше желание.'):label('Your first Deed.','Ваш первый шаг.')}</h2></div><JinnAvatar size="medium"/></div>
      <div className="first-state"><span className="first-pill">{row?label('SAVED WISH','ЖЕЛАНИЕ СОХРАНЕНО'):label('UNSAVED DRAFT','ЧЕРНОВИК НЕ СОХРАНЁН')}</span><span className="first-pill first-prepared">{label('DEED PREPARED','ПЕРВЫЙ ШАГ ПОДГОТОВЛЕН')}</span></div>
      <p className="first-intro">{row?label('Welcome back. Your saved Wish and latest corrections are ready for the next Deed.','С возвращением. Jinn видит это желание и ваши последние исправления.'):label('Your first Deed is ready to inspect and edit.','Первый шаг готов: его можно просмотреть и исправить.')}</p>
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
                <textarea rows={Math.max(2,Math.ceil(item.text.length/28))} maxLength={220} aria-label={`${section.title} ${t('step')} ${itemIndex+1}`} value={item.text}
                  onChange={e=>updateSection(index,{...section,items:section.items.map((it,i)=>i===itemIndex?{...it,text:e.target.value}:it)})}/>
                {item.dependsOn!==undefined&&<small>{t('After step {number}',{number:item.dependsOn+1})}</small>}
              </li>)}</ol>:
              <ol>{section.items.map((item,itemIndex)=><li key={itemIndex}><textarea rows={Math.max(2,Math.ceil(item.length/28))} maxLength={220} aria-label={`${section.title} ${t('question')} ${itemIndex+1}`}
                value={item} onChange={e=>updateSection(index,{...section,items:section.items.map((it,i)=>i===itemIndex?e.target.value:it)})}/></li>)}</ol>}
          </div>)}
          <div className="first-section"><label htmlFor="first-unknowns">{label('Still unknown','Пока неизвестно')}</label>
            <textarea id="first-unknowns" rows={Math.max(3,artifact.unknowns.length*2)} maxLength={1100} value={artifact.unknowns.join('\n')}
              onChange={e=>edit({...artifact,unknowns:e.target.value.split('\n').filter(Boolean)})}/></div>
          <p className="first-boundary">{artifact.boundary}</p>
        </article>
        <aside className="first-side"><div className="first-current" id="wish-current"><p className="eyebrow">{label('CURRENT WISH','ВАШЕ ЖЕЛАНИЕ')}</p><h3>{currentWish}</h3><p className="first-current-jinn">{label('With','Помогает')}: {companionName}</p><JinnAvatar size="medium"/></div><div className="first-next" id="wish-next"><p className="eyebrow">{label('ONE NEXT DEED','СЛЕДУЮЩИЙ ШАГ')}</p><h3>{artifact.nextDeed.title}</h3>
          <p>{artifact.nextDeed.why}</p><small>{artifact.nextDeed.prompt}</small></div>
          <div className="first-receipt" id="wish-history"><p className="eyebrow">{label('HISTORY · WORK RECEIPT','ИСТОРИЯ · ЗАПИСЬ О РАБОТЕ')}</p><strong>{label('PREPARED','ПОДГОТОВЛЕНО')}</strong><p>{receiptDescription(receipt)}</p><small>{label('Private draft only. Nothing sent, published, or independently fact-checked.','Личный черновик. Ничего не отправлено, не опубликовано и не проверено во внешних источниках.')}</small></div>
          {row&&row.deed_history.length>1&&<details className="first-history"><summary>{label('Earlier Deeds','Предыдущие шаги')} ({row.deed_history.length-1})</summary>
            <ol>{row.deed_history.slice(0,-1).map((item,index)=><li key={`${item.recordedAt}-${index}`}><strong>{label('PREPARED','ПОДГОТОВЛЕНО')}</strong><span>{receiptDescription(item)}</span><time>{formatLocalDateTime(item.recordedAt,locale)}</time></li>)}</ol>
          </details>}
          <div className="first-privacy"><LockKeyhole size={17}/><p>{row?label('Saved privately under your account.','Сохранено только в вашем аккаунте.'):label('This draft is only in this open session until you keep it.','Черновик останется только в этой сессии, пока вы его не сохраните.')} {label('No cross-wish memory or external action.','Нет общей памяти между желаниями и внешних действий.')}</p></div>
        </aside>
      </div>
      {!row&&<div className="first-jinn-assignment">
        <p>{label('Jinn will help you continue this Wish. You can name it later.','Jinn поможет Вам продолжить это желание. Имя можно выбрать позже.')}</p>
        {(jinnChoices.length>1||jinnUnavailable)&&<><label htmlFor="first-jinn-choice">{label('Keep this Wish with','Сохранить желание с')}</label>
          <select id="first-jinn-choice" value={saveJinnId} onChange={event=>{setSaveJinnId(event.target.value);setJinnUnavailable(false);setJinnValidated(true);}}>
            <option value="">{label('My default Jinn','Мой Jinn по умолчанию')}</option>
            {jinnChoices.map(jinn=><option key={jinn.id} value={jinn.id}>{jinn.name}</option>)}
          </select></>}
        {jinnUnavailable&&<div className="first-jinn-recovery" role="alert">
          <p className="error">{label('The previously selected Jinn is unavailable for this account. Your draft is safe.','Выбранный Jinn недоступен для этого аккаунта. Ваш черновик сохранён в текущей сессии.')}</p>
          <button type="button" className="first-secondary" onClick={()=>{setSaveJinnId('');setJinnUnavailable(false);setJinnValidated(true);}}>
            {label('Use my default Jinn','Использовать Jinn по умолчанию')}
          </button>
        </div>}
      </div>}
      <div className="first-footer-actions">
        <button className="primary" disabled={busy||jinnUnavailable||!jinnValidated||(!dirty&&!!row)} onClick={()=>void save()}>{busy?label('Working…','Подождите…'):row?(dirty?label('Save corrections','Сохранить исправления'):label('Corrections saved','Исправления сохранены')):label('Keep this wish','Сохранить желание')} {row&&!dirty?<Check size={16}/>:<ArrowRight size={16}/>}</button>
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
