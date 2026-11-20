import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { Artifact, DeedReceipt, Section } from '../../api/src/firstDeed';
import { validateExperiencePlan, type ExperiencePlanV1, type PlanAnswers } from '../../api/src/experiencePlan';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { listJinns, type JinnIdentity } from './jinnStore';
import { deleteFirstWish, loadFirstWish, saveFirstWish, savePreparedFirstValue, saveTrustedContext, updateFirstWish, type FirstWishRow } from './firstWishStore';
import { correctSource, validateEditedArtifact } from './firstWishModel';
import { browserDiagnostic, diagnosticCode } from './browserDiagnostics';
import JinnAvatar from './JinnAvatar';
import FirstValueExperience from './FirstValueExperience';
import { formatLocalDateTime, localizeError, useLocale, type Locale } from './i18n';

type Props={wish:string;savedId?:string|null;preferredJinnId?:string|null;preferredJinnOwnerId?:string|null;preferredJinnName?:string|null;onBack:()=>void;onRequireAuth:()=>void;onDeleted:()=>void;onSaved:(id:string)=>void};
type Phase='clarify'|'answer'|'working'|'workspace'|'start-error';
const API=import.meta.env.VITE_API_BASE_URL||'';
const FOLLOW_UP_OPERATION='AI prepared a follow-up draft from the saved, corrected artifact';

type ContinuationProposal={plan:ExperiencePlanV1;snapshot:{sourceId:string;sourceVersion:number;contextRevision:number;actorId:string;latestDeedId:string};editRequest:string;expires:number;proof:string};
async function endpoint(body:{mode:string} & Record<string,unknown>, locale:Locale, token?:string){
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
  const [plan,setPlan]=useState<ExperiencePlanV1|null>(null);
  const [questionIndex,setQuestionIndex]=useState(0);
  const [answers,setAnswers]=useState<PlanAnswers>({});
  const [selectedChoice,setSelectedChoice]=useState('');
  const [useOther,setUseOther]=useState(false);
  const [artifact,setArtifact]=useState<Artifact|null>(null);
  const [receipt,setReceipt]=useState<DeedReceipt|null>(null);
  const [issuedArtifact,setIssuedArtifact]=useState<Artifact|null>(null);
  const [preparationProof,setPreparationProof]=useState('');
  const [row,setRow]=useState<FirstWishRow|null>(null);
  const [proposal,setProposal]=useState<ContinuationProposal|null>(null);
  const [reviewing,setReviewing]=useState(false);
  const [notNow,setNotNow]=useState(false);
  const [editRequest,setEditRequest]=useState('');
  const [contextFacts,setContextFacts]=useState('');
  const [contextUnknowns,setContextUnknowns]=useState('');
  const [contextDirty,setContextDirty]=useState(false);
  const pendingRequestKey=useRef<string|null>(null);
  const [jinnChoices,setJinnChoices]=useState<JinnIdentity[]>([]);
  const [saveJinnId,setSaveJinnId]=useState<string>(preferredJinnId||'');
  const [jinnUnavailable,setJinnUnavailable]=useState(false);
  const [jinnValidated,setJinnValidated]=useState(!preferredJinnId);
  const [dirty,setDirty]=useState(false);
  const sourceBaseline=useRef('');
  // React StrictMode repeats mount effects in development; reuse one request
  // for the same Wish/Jinn/locale so it does not trigger duplicate paid LLM calls.
  const planRequestRef=useRef<{key:string;promise:Promise<{plan:unknown}>}|null>(null);
  // Once preparation begins, account/Jinn/locale refreshes must never
  // replace it with a new plan or hide the unsaved First Artifact.
  const preparingRef=useRef(false);
  const preparedRef=useRef(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retryAttempt,setRetryAttempt]=useState(0);
  const currentWish=row?.aspiration||wish;
  const selectSaved=(saved:FirstWishRow,id?:string)=>{
    const selected=saved.artifacts.find(item=>item.id===id)||saved.artifacts.at(-1)!;
    setRow({...saved,first_artifact:selected.artifact,first_deed:selected.receipt,
      revision:selected.revision,artifact_id:selected.id});
    setArtifact(selected.artifact);setReceipt(selected.receipt);
    sourceBaseline.current=selected.artifact.sourceNote;
    setContextFacts(saved.context.confirmedFacts.join('\n'));
    setContextUnknowns(saved.context.unknowns.join('\n'));
    setContextDirty(false);setDirty(false);setPhase('workspace');
  };
  // A late planning callback cannot conceal a verified prepared draft.
  const viewPhase:Phase=!savedId&&artifact&&receipt?'workspace':phase;
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
    if(!savedId&&(preparingRef.current||preparedRef.current))return()=>{live=false;};
    setError('');
    // Wait for the verified chosen Jinn identity before requesting first-use planning.
    if(!savedId&&preferredJinnId&&!jinnValidated)return()=>{live=false;};
    setPhase('working');
    if(savedId){
      void loadFirstWish(savedId).then(saved=>{if(!live)return;selectSaved(saved);setProposal(null);})
        .catch(e=>{if(live){setError(localizeError(e,locale,'Could not load wish.'));setPhase('workspace');}});
    }else{
      const purpose=jinnChoices.find(jinn=>jinn.id===saveJinnId)?.purpose||'';
      const requestKey=JSON.stringify([wish,locale,companionName,saveJinnId,purpose,retryAttempt]);
      if(planRequestRef.current?.key!==requestKey){
        planRequestRef.current={
          key:requestKey,
          promise:endpoint({
            mode:'plan',wish,jinnName:companionName,
            jinnPurpose:purpose||undefined,
          },locale),
        };
      }
      void planRequestRef.current.promise.then(data=>{
        if(!live||preparingRef.current||preparedRef.current)return;
        const validated=validateExperiencePlan(data.plan,locale);
        setPlan(validated);setQuestionIndex(0);setAnswers({});setSelectedChoice('');setUseOther(false);
        setPhase(validated.questions.length?'answer':'clarify');
      }).catch(e=>{if(live&&!preparingRef.current&&!preparedRef.current){
        setError(localizeError(e,locale,'Could not begin.'));setPhase('start-error');
      }});
    }
    return()=>{live=false;};
  },[savedId,wish,retryAttempt,locale,preferredJinnId,jinnValidated]);

  const prepare=async(selected:PlanAnswers=answers)=>{
    if(!plan||preparingRef.current||preparedRef.current)return;
    preparingRef.current=true;
    setBusy(true);setError('');setPhase('working');
    try{
      const result=await endpoint({mode:'prepare',wish,plan,answers:selected},locale);
      preparedRef.current=true;
      setArtifact(result.artifact);setIssuedArtifact(result.artifact);
      setPreparationProof(typeof result.proof==='string'?result.proof:'');
      sourceBaseline.current=result.artifact.sourceNote;setReceipt(result.receipt);setPhase('workspace');
    }catch(e){setError(localizeError(e,locale,'Could not prepare this deed.'));setPhase('clarify');}
    finally{preparingRef.current=false;setBusy(false);}
  };
  const respond=(value:string)=>{
    const current=plan?.questions[questionIndex];
    if(!current)return;
    const next={...answers,[current.id]:value};
    setAnswers(next);setSelectedChoice('');setUseOther(false);
    if(questionIndex+1<(plan?.questions.length||0)){
      setQuestionIndex(index=>index+1);
    }else setPhase('clarify');
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
        if(artifact.experience){
          if(!issuedArtifact||!preparationProof)
            throw new Error('Verified preparation is missing. Retry preparing this Deed.');
          onSaved(await savePreparedFirstValue(wish,artifact,issuedArtifact,receipt,
            preparationProof,saveJinnId||undefined));
        }else onSaved(await saveFirstWish(wish,artifact,receipt,saveJinnId||undefined));
        return;
      }
      const saved=await updateFirstWish(row,artifact);
      selectSaved(saved,row.artifact_id);setProposal(null);pendingRequestKey.current=null;
    }catch(e){
      if(e instanceof Error && e.name==='WishSignInRequired')onRequireAuth();else setError(localizeError(e,locale,'Could not save your wish.'));
    }finally{setBusy(false);}
  };
  const token=async()=>{
    const {data:{session},error:sessionError}=await getSupabase().auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Sign in to continue this wish.');
    return session.access_token;
  };
  const reviewContinuation=async(request='')=>{
    if(!row||dirty||contextDirty)return;
    setBusy(true);setError('');setNotNow(false);
    try{
      const result=await endpoint({mode:'propose_continuation',wishId:row.id,
        sourceId:row.artifacts.at(-1)!.id,editRequest:request.trim()},locale,await token());
      setProposal({...result,plan:validateExperiencePlan(result.plan,locale)});
      setReviewing(true);setEditRequest(request.trim());pendingRequestKey.current=null;
    }catch(e){setError(localizeError(e,locale,'Could not review the next Deed.'));}
    finally{setBusy(false);}
  };
  const startContinuation=async()=>{
    if(!row||!proposal||dirty||contextDirty||editRequest.trim()!==proposal.editRequest)return;
    setBusy(true);setError('');
    const requestKey=pendingRequestKey.current||crypto.randomUUID();
    pendingRequestKey.current=requestKey;
    try{
      const bearer=await token();
      let result;
      try{result=await endpoint({mode:'execute_continuation',wishId:row.id,
        sourceId:proposal.snapshot.sourceId,requestKey,proposal,editRequest},locale,bearer);}
      catch(error){
        try{result=await endpoint({mode:'resolve_continuation',wishId:row.id,requestKey,
          proposal,editRequest},locale,bearer);}
        catch{throw error;}
      }
      const saved=await loadFirstWish(row.id);
      selectSaved(saved,result.artifactId);setProposal(null);setReviewing(false);
      pendingRequestKey.current=null;
    }catch(e){setError(localizeError(e,locale,'The next Deed could not be confirmed. Retry with the same request.'));}
    finally{setBusy(false);}
  };
  const saveContext=async()=>{
    if(!row||dirty)return;
    setBusy(true);setError('');
    try{
      const facts=contextFacts.split('\n').map(x=>x.trim()).filter(Boolean);
      const unknowns=contextUnknowns.split('\n').map(x=>x.trim()).filter(Boolean);
      if(facts.length>6||unknowns.length>6||[...facts,...unknowns].some(x=>x.length>180))
        throw new Error('Keep at most six short confirmed details and six unknowns.');
      const saved=await saveTrustedContext(row,facts,unknowns);
      selectSaved(saved,row.artifact_id);setProposal(null);pendingRequestKey.current=null;
    }catch(e){setError(localizeError(e,locale,'Could not save confirmed context.'));}
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
  return <section className={'first-wish entrance '+(viewPhase==='workspace'?'is-workspace':'is-conversation')} aria-live="polite">
    <div className="journey-top"><button type="button" className="first-back" onClick={onBack}><ArrowLeft size={16}/> {savedId?label('My Jinns','Мои Jinn'):label('Back to wish','Назад')}</button><span>{label('WISH · FIRST DEED · WORKSPACE','ЖЕЛАНИЕ · ПЕРВЫЙ ШАГ · РАБОТА')}</span></div>
    <div className="first-jinn"><JinnAvatar size={viewPhase==='workspace'?'small':'large'}/><span><strong>{companionName}</strong><small>{row?label('Currently assigned to this Wish · Wish-local context','Сейчас помогает с этим желанием · отдельный контекст'):label('Making this Wish with you · Wish-local context','Помогу с этим желанием · отдельный контекст')}</small></span>
      {row&&<button type="button" className="first-jinn-switch" onClick={onBack}>{label('Switch Jinn / My Jinns','Сменить Jinn / Мои Jinn')}</button>}</div>
    {viewPhase==='workspace'&&artifact&&<nav className="workspace-nav" aria-label={label('Wish workspace','Работа с желанием')}>
      <a href="#wish-current">{label('Current wish','Желание')}</a><a href="#wish-artifacts">{label('Artifacts','Документы')}</a><a href={row?'#wish-continuation':'#wish-next'}>{label('Next step','Следующий шаг')}</a><a href={row?.artifacts.length&&row.artifacts.length>1?'#saved-artifacts':'#wish-history'}>{label('History','История')}</a>
    </nav>}
    <p className="eyebrow">{label('YOUR WISH','ВАШЕ ЖЕЛАНИЕ')}</p><h1>{currentWish}</h1>
    {viewPhase==='start-error'&&<div className="first-panel">
      <p className="error" role="alert">{error}</p>
      <p>{t('Your Wish is unchanged. You can retry, or go back and add one concrete detail that helps Jinn prepare a grounded first result.')}</p>
      <button type="button" className="primary" onClick={()=>setRetryAttempt(attempt=>attempt+1)}>
        <RotateCcw size={16}/> {label('Retry starting wish','Попробовать снова')}
      </button>
    </div>}
    {viewPhase==='clarify'&&!artifact&&plan&&<div className="first-panel first-value-entry">
      <p className="first-panel-kicker">{t('PROPOSED FIRST DEED')}</p>
      <h2>{plan.deed.title}</h2><p className="first-value-preview-outcome">{plan.firstOutcome}</p>
      <small>{t('Private preparation only. No external action was performed.')}</small>
      <div className="first-actions"><button type="button" className="primary" disabled={busy}
        onClick={()=>void prepare(answers)}>{t('Let Jinn prepare it')} <ArrowRight size={16}/></button>
        <button type="button" className="first-secondary" disabled={busy}
          onClick={()=>setRetryAttempt(value=>value+1)}>{t('Change the plan')}</button></div>
      {error&&<p className="error" role="alert">{error}</p>}
    </div>}
    {viewPhase==='answer'&&plan&&plan.questions[questionIndex]&&<div className="first-panel first-value-entry">
      <p className="first-panel-kicker">{t('A question from {name}',{name:companionName})}
        <span className="first-value-question-count"> {questionIndex+1}/{plan.questions.length}</span></p>
      <h2 className="first-value-question">{plan.questions[questionIndex].prompt}</h2>
      <p className="first-value-outcome">{plan.questions[questionIndex].why}</p>
      <fieldset className="first-value-choices">
        <legend>{t('Choose what fits')}</legend>
        <div className="first-value-choice-list">{plan.questions[questionIndex].choices.map(choice=>
          <button type="button" key={choice} aria-pressed={!useOther&&selectedChoice===choice}
            className={!useOther&&selectedChoice===choice?'first-value-choice is-selected':'first-value-choice'}
            onClick={()=>{setSelectedChoice(choice);setUseOther(false);}}>{choice}</button>)}
          <button type="button" className={useOther?'first-value-choice is-selected':'first-value-choice'}
            aria-pressed={useOther} onClick={()=>{setUseOther(true);setSelectedChoice('');}}>{t('Other')}</button>
        </div>
        {useOther&&<label className="first-value-other" htmlFor="first-other">{t('Your own answer')}
          <input id="first-other" autoFocus maxLength={160} value={selectedChoice}
            onChange={event=>setSelectedChoice(event.target.value)} placeholder={t('A few words are enough')}/></label>}
      </fieldset>
      <div className="first-actions">
        <button type="button" className="primary" disabled={busy||!selectedChoice.trim()}
          onClick={()=>respond(selectedChoice.trim())}>{t('Continue')}
          <ArrowRight size={16}/></button>
        <button type="button" className="first-secondary" disabled={busy} onClick={()=>respond('__unsure__')}>{t('I’m not sure')}</button>
        <button type="button" className="first-secondary" disabled={busy} onClick={()=>respond('__skip__')}>{t('Skip')}</button>
      </div>
      {error&&<p className="error" role="alert">{error}</p>}
    </div>}
    {viewPhase==='working'&&<div className="first-panel" role="status"><p className="first-panel-kicker"><Sparkles size={16}/> {t('{name} is with you',{name:companionName})}</p>{savedId?label('Welcome back. Opening your saved work…','С возвращением. Открываю сохранённую работу…'):busy?label('Preparing your first Deed…','Готовлю ваш первый шаг…'):label('Finding one good place to start…','Ищу хороший первый шаг…')}</div>}
    {viewPhase==='workspace'&&artifact&&receipt&&<>
      <div className="workspace-intro"><div><p className="eyebrow">{row?label('WELCOME BACK','С ВОЗВРАЩЕНИЕМ'):label('YOUR FIRST DEED','ВАШ ПЕРВЫЙ ШАГ')}</p><h2>{row?label('Continue your wish.','Продолжим ваше желание.'):label('Your first Deed.','Ваш первый шаг.')}</h2></div><JinnAvatar size="medium"/></div>
      <div className="first-state"><span className="first-pill">{row?label('SAVED WISH','ЖЕЛАНИЕ СОХРАНЕНО'):label('UNSAVED DRAFT','ЧЕРНОВИК НЕ СОХРАНЁН')}</span><span className="first-pill first-prepared">{row&&row.artifacts.find(item=>item.id===row.artifact_id)?.verified!==true?t('Legacy receipt unverified'):label('DEED PREPARED','ПЕРВЫЙ ШАГ ПОДГОТОВЛЕН')}</span></div>
      <p className="first-intro">{row?label('Welcome back. Your saved Wish and latest corrections are ready for the next Deed.','С возвращением. Jinn видит это желание и ваши последние исправления.'):label('Your first Deed is ready to inspect and edit.','Первый шаг готов: его можно просмотреть и исправить.')}</p>
      {row&&<section className="continuation-panel" id="wish-continuation" aria-label={t('Next Deed review')}>
        <p className="eyebrow">{t('ONE NEXT DEED')}</p>
        {!notNow&&<><h3>{proposal?proposal.plan.deed.title:row.artifacts.at(-1)!.artifact.nextDeed.title}</h3>
          <p>{proposal?proposal.plan.firstOutcome:row.artifacts.at(-1)!.artifact.nextDeed.why}</p>
          <small>{t('Private draft only. Nothing sent or verified.')}</small></>}
        <details className="continuation-context" open={contextDirty||undefined}>
          <summary>{t('Using what you told me')}</summary>
          <p>{row.context.sourceNote||t('No personal details supplied.')}</p>
          {row.context.sourceNote&&!row.context.sourceNoteConfirmed&&<p className="first-hint">{t('Confirm this source note before continuing.')}</p>}
          <p>{row.context.confirmedFacts.length?row.context.confirmedFacts.join(' · '):t('No confirmed details yet.')}</p>
          <p>{t('Unknowns')}: {row.context.unknowns.join(' · ')||t('None listed')}</p>
          <p className="first-hint">{t('Correct the source note in the Artifact editor. Draft text alone is not a confirmed fact.')}</p>
          <label htmlFor="confirmed-facts">{t('Confirmed details, one per line')}</label>
          <textarea id="confirmed-facts" rows={3} maxLength={1100} value={contextFacts}
            onChange={event=>{setContextFacts(event.target.value);setContextDirty(true);}}/>
          <label htmlFor="confirmed-unknowns">{t('Still unknown, one per line')}</label>
          <textarea id="confirmed-unknowns" rows={2} maxLength={1100} value={contextUnknowns}
            onChange={event=>{setContextUnknowns(event.target.value);setContextDirty(true);}}/>
          <button type="button" className="first-secondary" disabled={busy||dirty||(!contextDirty&&(!row.context.sourceNote||row.context.sourceNoteConfirmed))}
            onClick={()=>void saveContext()}>{t('Save confirmed context')}</button>
        </details>
        {reviewing&&proposal&&<div className="continuation-review">
          <p><strong>{proposal.plan.deed.title}</strong> — {proposal.plan.deed.result}</p>
          <p>{t('Using what you told me')}: {row.context.sourceNote||row.context.confirmedFacts.join(' · ')||t('No personal details supplied.')}</p>
          <label htmlFor="continuation-edit-request">{t('Edit request')}</label>
          <textarea id="continuation-edit-request" maxLength={280} rows={2} value={editRequest}
            onChange={event=>setEditRequest(event.target.value)}/>
          <div className="first-actions"><button type="button" className="primary" disabled={busy||dirty||contextDirty||editRequest.trim()!==proposal.editRequest}
            onClick={()=>void startContinuation()}>{busy?t('Preparing…'):t('Start Deed')}</button>
            {editRequest.trim()!==proposal.editRequest&&<button type="button" className="first-secondary" disabled={busy}
              onClick={()=>void reviewContinuation(editRequest)}>{t('Update proposal')}</button>}
            <button type="button" className="first-secondary" disabled={busy} onClick={()=>{setProposal(null);setReviewing(false);setNotNow(true);pendingRequestKey.current=null;}}>{t('Not now')}</button></div>
        </div>}
        {!reviewing&&<div className="first-actions">
          <button type="button" className="primary" disabled={busy||dirty||contextDirty||!!(row.context.sourceNote&&!row.context.sourceNoteConfirmed)}
            onClick={()=>void reviewContinuation()}>{busy?t('Preparing…'):t('Review next Deed')}</button>
          {!notNow&&<button type="button" className="first-secondary" disabled={busy}
            onClick={()=>setNotNow(true)}>{t('Not now')}</button>}
        </div>}
      </section>}
      {row&&row.artifacts.length>1&&<details className="continuation-history" id="saved-artifacts">
        <summary>{t('Saved Artifacts')} ({row.artifacts.length})</summary>
        <div className="continuation-artifact-list">{row.artifacts.map((item,index)=><button type="button" key={item.id}
          aria-current={item.id===row.artifact_id?'true':undefined} disabled={busy||dirty||contextDirty}
          onClick={()=>{selectSaved(row,item.id);setProposal(null);setReviewing(false);pendingRequestKey.current=null;}}>
          {index+1}. {item.artifact.title} · {item.actorName??t('Unknown Jinn')}</button>)}</div>
      </details>}
      {artifact.experience?<FirstValueExperience key={row?.artifact_id||'unsaved'} artifact={artifact} receipt={receipt} saved={!!row}
        wish={currentWish} companionName={companionName} isFirst={!row||row.artifacts[0]?.id===row.artifact_id}
        actorName={row?.artifacts.find(item=>item.id===row.artifact_id)?.actorName}
        verified={!row||row.artifacts.find(item=>item.id===row.artifact_id)?.verified===true}
        showNext={!row} onChange={edit}/>:
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
          <div className="first-receipt" id="wish-history"><p className="eyebrow">{label('HISTORY · WORK RECEIPT','ИСТОРИЯ · ЗАПИСЬ О РАБОТЕ')}</p><strong>{row&&row.artifacts.find(item=>item.id===row.artifact_id)?.verified!==true?t('Legacy receipt unverified'):label('PREPARED','ПОДГОТОВЛЕНО')}</strong><p>{receiptDescription(receipt)}</p><small>{label('Private draft only. Nothing sent, published, or independently fact-checked.','Личный черновик. Ничего не отправлено, не опубликовано и не проверено во внешних источниках.')}</small></div>
          {row&&row.deed_history.length>1&&<details className="first-history"><summary>{label('Earlier Deeds','Предыдущие шаги')} ({row.deed_history.length-1})</summary>
            <ol>{row.deed_history.slice(0,-1).map((item,index)=><li key={`${item.recordedAt}-${index}`}><strong>{item.verifiedRecord?label('PREPARED','ПОДГОТОВЛЕНО'):t('Legacy receipt unverified')}</strong><span>{receiptDescription(item)}</span><time>{formatLocalDateTime(item.recordedAt,locale)}</time></li>)}</ol>
          </details>}
          <div className="first-privacy"><LockKeyhole size={17}/><p>{row?label('Saved privately under your account.','Сохранено только в вашем аккаунте.'):label('This draft is only in this open session until you keep it.','Черновик останется только в этой сессии, пока вы его не сохраните.')} {label('No cross-wish memory or external action.','Нет общей памяти между желаниями и внешних действий.')}</p></div>
        </aside>
      </div>}
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
      </div>
      {dirty&&row&&<p className="first-hint">{label('Save your corrections before preparing the next Deed.','Сохраните исправления перед следующим шагом.')}</p>}
      {row&&<button className="first-delete" disabled={busy} onClick={()=>void remove()}><Trash2 size={15}/> {label('Delete wish and artifact','Удалить желание и документ')}</button>}
      {error&&<p className="error" role="alert">{error}</p>}
    </>}
    {viewPhase==='workspace'&&!artifact&&error&&<div>
      <p className="error" role="alert">{error}</p>
      <button type="button" className="first-secondary" onClick={()=>setRetryAttempt(attempt=>attempt+1)}>
        <RotateCcw size={16}/> {label('Retry opening wish','Попробовать снова')}
      </button>
    </div>}
  </section>;
}
