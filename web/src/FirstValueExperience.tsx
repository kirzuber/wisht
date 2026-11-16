import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Pencil } from 'lucide-react';
import type { Artifact, DeedReceipt, Section } from '../../api/src/firstDeed';
import { validateExperiencePlan } from '../../api/src/experiencePlan';
import { correctSource } from './firstWishModel';
import { useLocale, formatLocalDateTime } from './i18n';

/** Trusted renderer. The model supplies data + allowlisted IDs, never JSX/HTML/JS. */
type Props={
  artifact:Artifact;
  receipt:DeedReceipt;
  saved:boolean;
  dirty:boolean;
  wish:string;
  companionName:string;
  onChange:(artifact:Artifact)=>void;
  onContinue?:()=>void;
  busy:boolean;
};
const readable=(text:string)=><div className="first-value-prose">{text.split('\n').map((line,i)=>
  <p key={i}>{line.trim()||'\u00a0'}</p>)}</div>;
export default function FirstValueExperience({artifact,receipt,saved,dirty,wish,companionName,onChange,onContinue,busy}:Props){
 const {t,locale}=useLocale();
 const plan=artifact.experience?validateExperiencePlan(artifact.experience):null;
 const [editing,setEditing]=useState(false);
 const [sourceOriginal,setSourceOriginal]=useState(artifact.sourceNote);
 if(!plan)return null;
 const changeSection=(index:number,section:Section)=>onChange({...artifact,sections:artifact.sections.map((item,i)=>i===index?section:item)});
 const supporting=plan.components.includes('supporting_section');
 const firstIndex=artifact.sections.findIndex(section=>section.type==='document');
 const mainIndex=firstIndex<0?0:firstIndex;
 const otherIndices=artifact.sections.map((_,i)=>i).filter(i=>i!==mainIndex);
 const renderSection=(section:Section,index:number)=><section className="first-value-section" key={index}>
   <h3>{section.title}</h3>
   {editing?(section.type==='document'?
     <textarea aria-label={section.title} rows={Math.min(16,Math.max(6,Math.ceil(section.body.length/55)))} maxLength={2500}
       value={section.body} onChange={event=>changeSection(index,{...section,body:event.target.value})}/>:
     section.type==='checklist'?
       <ol>{section.items.map((item,i)=><li key={i}><textarea aria-label={`${section.title} ${i+1}`} rows={2} maxLength={220}
         value={item.text} onChange={event=>changeSection(index,{...section,items:section.items.map((v,j)=>i===j?{...v,text:event.target.value}:v)})}/></li>)}</ol>:
       <ol>{section.items.map((item,i)=><li key={i}><textarea aria-label={`${section.title} ${i+1}`} rows={2} maxLength={220}
         value={item} onChange={event=>changeSection(index,{...section,items:section.items.map((v,j)=>i===j?event.target.value:v)})}/></li>)}</ol>):
     section.type==='document'?readable(section.body):
     <ol>{section.items.map((item,i)=><li key={i}>{typeof item==='string'?item:item.text}</li>)}</ol>}
 </section>;
 const registry:Partial<Record<(typeof plan.components)[number],()=>ReactNode>>={
  deed_proposal:()=> <section className="first-value-proposal" aria-label={t('First Deed proposal')}>
    <p className="eyebrow">{t('Prepared First Deed')}</p>
    <h3>{plan.deed.title}</h3><p>{plan.firstOutcome}</p><small>{t('Current wish')}: {wish}</small>
    <small>{t('Private preparation only. No external action was performed.')}</small>
  </section>,
  artifact_reader:()=> <article className="first-value-reader" id="wish-artifacts">
    <header><span className="eyebrow">{t('YOUR FIRST ARTIFACT')}</span>
      <button type="button" className="first-value-edit" aria-pressed={editing}
        onClick={()=>setEditing(value=>!value)}><Pencil size={15}/> {editing?t('Finish editing'):t('Edit artifact')}</button>
      <h2>{artifact.title}</h2>
      <p className="first-value-artifact-hint">{t('A working draft you can read and use now. Suggestions are not verified personal facts.')} {t('With')}: {companionName}</p>
    </header>
    {renderSection(artifact.sections[mainIndex],mainIndex)}
    {!supporting&&otherIndices.map(i=>renderSection(artifact.sections[i],i))}
  </article>,
  supporting_section:()=> otherIndices.length>0?<details className="first-value-support">
    <summary>{t('Supporting material')} ({otherIndices.length})</summary>
    {otherIndices.map(i=>renderSection(artifact.sections[i],i))}
  </details>:null,
  source_status:()=> <details className="first-value-source" open={editing||undefined}>
    <summary>{t('Sources and unknowns')}</summary>
    <p className="eyebrow">{t('From you · source note')}</p>
    {editing?<textarea id="first-source-note" rows={3} maxLength={500} value={artifact.sourceNote}
      onChange={event=>onChange({...artifact,sourceNote:event.target.value})}
      onBlur={()=>{
       if(artifact.sourceNote!==sourceOriginal){
        onChange(correctSource({...artifact,sourceNote:sourceOriginal},artifact.sourceNote));
        setSourceOriginal(artifact.sourceNote);
       }
      }}/>:<p>{artifact.sourceNote||t('No personal details supplied.')}</p>}
    <p className="eyebrow">{t('Still unknown')}</p>
    {editing?<textarea aria-label={t('Still unknown')} rows={Math.max(3,artifact.unknowns.length)} maxLength={1100}
      value={artifact.unknowns.join('\n')} onChange={event=>onChange({...artifact,unknowns:event.target.value.split('\n').filter(Boolean)})}/>:
      artifact.unknowns.length?<ul>{artifact.unknowns.map((u,i)=><li key={i}>{u}</li>)}</ul>:<p>{t('No unknowns listed.')}</p>}
    <p className="first-boundary">{artifact.boundary}</p>
  </details>,
  next_deed:()=> <section className="first-value-next" id="wish-next"><p className="eyebrow">{t('ONE NEXT DEED')}</p>
    <h3>{artifact.nextDeed.title}</h3><p>{artifact.nextDeed.why}</p><small>{artifact.nextDeed.prompt}</small>
    {saved&&onContinue&&<button type="button" disabled={busy||dirty||editing} className="first-secondary"
      onClick={onContinue}>{t('Prepare next Deed')} <ArrowRight size={15}/></button>}
  </section>,
  work_receipt:()=> <details className="first-value-receipt" id="wish-history">
    <summary>{t('Work receipt')} · {t('PREPARED')}</summary>
    <p>{t('AI generated and checked an editable draft against supplied facts')}</p>
    <time>{formatLocalDateTime(receipt.recordedAt,locale)}</time>
    <small>{t('Private draft only. Nothing sent, published, or independently fact-checked.')}</small>
  </details>,
 };
 return <div className="first-value-experience" aria-label={t('Wish workspace')}>
  {plan.components.map((component,i)=>{
   // Jinn identity remains the trusted shell; choice chips were shown BEFORE preparation.
   const render=registry[component];
   return render?<div key={component} className={`first-value-block first-value-${i}`}>{render()}</div>:null;
  })}
  <p className="first-value-storage"><Check size={15}/>{saved?
    t('Saved privately under your account.'):t('This draft is only in this open session until you keep it.')}</p>
 </div>;
}
