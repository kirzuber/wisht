import type { Opportunity } from './scout.js';

export type WatchDiff={
  isBaseline:boolean;newMatches:Opportunity[];changedMatches:Opportunity[];
};

/** Stable listing identity: same contest with a new deadline stays the same listing. */
export function watchIdentity(opportunity:Pick<Opportunity,'sourceUrl'>):string{
  try {
    const url=new URL(opportunity.sourceUrl);
    if(!['pixcontests.com','www.pixcontests.com'].includes(url.hostname))
      throw new Error('Unknown source');
    return url.pathname.toLowerCase().replace(/\/+$/,'');
  }catch{return opportunity.sourceUrl;}
}

/** Dedupe against ALL previous successful runs, not only yesterday.
 * A changed title/deadline is surfaced separately from a first-time finding.
 */
export function diffWatchResults(current:Opportunity[],successfulHistory:Opportunity[][]):WatchDiff{
  if(successfulHistory.length===0)return {isBaseline:true,newMatches:[],changedMatches:[]};
  const previous=new Map<string,Opportunity>();
  for(const run of successfulHistory){
    for(const item of run){const key=watchIdentity(item);if(!previous.has(key))previous.set(key,item);}
  }
  const newMatches:Opportunity[]=[];
  const changedMatches:Opportunity[]=[];
  const encountered=new Set<string>();
  for(const item of current){
    const key=watchIdentity(item);
    if(encountered.has(key))continue;
    encountered.add(key);
    const old=previous.get(key);
    if(!old)newMatches.push(item);
    else if(old.title!==item.title || old.deadline!==item.deadline)changedMatches.push(item);
  }
  return {isBaseline:false,newMatches,changedMatches};
}
