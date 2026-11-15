import type { Artifact } from '../../api/src/firstDeed';

/** The source note is authoritative; reflect a correction in any draft text that copied it. */
export function correctSource(artifact:Artifact,next:string):Artifact{
  const old=artifact.sourceNote;
  let prefix=0;
  while(prefix<old.length&&prefix<next.length&&old[prefix]===next[prefix])prefix++;
  let suffix=0;
  while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
  const removed=old.slice(prefix,old.length-suffix);
  const added=next.slice(prefix,next.length-suffix);
  const swap=(text:string)=>{
    let result=old?text.split(old).join(next):text;
    if(removed.length>=3)result=result.split(removed).join(added);
    return result;
  };
  return {...artifact,title:swap(artifact.title),sourceNote:next,sections:artifact.sections.map(section=>{
    if(section.type==='document')return {...section,title:swap(section.title),body:swap(section.body)};
    if(section.type==='checklist')return {...section,title:swap(section.title),items:section.items.map(item=>({...item,text:swap(item.text)}))};
    return {...section,title:swap(section.title),items:section.items.map(swap)};
  }),unknowns:artifact.unknowns.map(swap),boundary:swap(artifact.boundary),nextDeed:{...artifact.nextDeed,
    title:swap(artifact.nextDeed.title),why:swap(artifact.nextDeed.why),prompt:swap(artifact.nextDeed.prompt)}};
}

export function validateEditedArtifact(artifact:Artifact):void{
  if(artifact.sourceNote.length>500)throw new Error('Keep the source note under 500 characters.');
  if(artifact.unknowns.length>6||artifact.unknowns.some(x=>x.length>180))
    throw new Error('Keep up to six unknowns, each under 180 characters.');
  for(const section of artifact.sections){
    if(section.type==='document'&&(!section.body.trim()||section.body.length>2500))
      throw new Error('Keep each document section between 1 and 2,500 characters.');
    if(section.type==='checklist'&&section.items.some(x=>!x.text.trim()||x.text.length>220))
      throw new Error('Keep each checklist step between 1 and 220 characters.');
    if(section.type==='questions'&&section.items.some(x=>!x.trim()||x.length>220))
      throw new Error('Keep each question between 1 and 220 characters.');
  }
}
