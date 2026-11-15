import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { matchingWish } from './wishDedup';
import type { Artifact, DeedReceipt } from '../../api/src/firstDeed';

export type FirstWishRow = { id:string; aspiration:string; first_artifact:Artifact; first_deed:DeedReceipt;
  deed_history:DeedReceipt[]; revision:number; jinn_id:string };

export async function listFirstWishes(): Promise<Array<{id:string;aspiration:string;updated_at:string}>> {
  const user=await getAuthenticatedUser();
  const {data,error}=await getSupabase().from('wishes').select('id,aspiration,updated_at')
    .eq('user_id',user.id).not('first_artifact','is',null).order('updated_at',{ascending:false});
  if(error)throw error;
  return data || [];
}

export async function loadFirstWish(id:string): Promise<FirstWishRow> {
  const user=await getAuthenticatedUser();
  const {data,error}=await getSupabase().from('wishes')
    .select('id,aspiration,first_artifact,first_deed,deed_history,revision,jinn_id')
    .eq('id',id).eq('user_id',user.id).single();
  if(error||!data||!data.first_artifact)throw new Error('This saved wish is unavailable.');
  return data as FirstWishRow;
}

export async function saveFirstWish(wish:string,artifact:Artifact,receipt:DeedReceipt): Promise<FirstWishRow> {
  const user=await getAuthenticatedUser();
  const db=getSupabase();
  const {data:existing,error:readError}=await db.from('wishes').select('id,aspiration,kind').eq('user_id',user.id);
  if(readError)throw readError;
  if(matchingWish({aspiration:wish,kind:'personal'},existing||[]))throw new Error('This wish is already saved. Open it from My wishes.');
  if((existing||[]).length>=3)throw new Error('Your three wishes are already saved. Delete one before keeping another.');
  const {data:jinn,error:jinnError}=await db.from('jinns').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true})
    .select('id').single();
  let jinnId=jinn?.id as string|undefined;
  if(jinnError||!jinnId){
    const {data:found,error}=await db.from('jinns').select('id').eq('user_id',user.id).single();
    if(error||!found)throw jinnError||error||new Error('Could not load your Jinn.');
    jinnId=found.id;
  }
  const {data,error}=await db.from('wishes').insert({user_id:user.id,aspiration:wish,kind:'personal',
    mission_id:'first-real-deed',answer:artifact.sourceNote||'No detail supplied',status:'PLANNED',
    jinn_id:jinnId,first_artifact:artifact,first_deed:receipt,deed_history:[receipt]})
    .select('id,aspiration,first_artifact,first_deed,deed_history,revision,jinn_id').single();
  if(error||!data)throw error||new Error('Could not save this wish.');
  return data as FirstWishRow;
}

/** Optimistic revision protects a correction from a stale tab silently overwriting it. */
export async function updateFirstWish(row:FirstWishRow,artifact:Artifact,receipt?:DeedReceipt): Promise<FirstWishRow> {
  const user=await getAuthenticatedUser();
  const history=receipt?[...row.deed_history,receipt].slice(-20):row.deed_history;
  const {data,error}=await getSupabase().from('wishes').update({first_artifact:artifact,
    first_deed:receipt||row.first_deed,deed_history:history,updated_at:new Date().toISOString(),revision:row.revision+1})
    .eq('id',row.id).eq('user_id',user.id).eq('revision',row.revision)
    .select('id,aspiration,first_artifact,first_deed,deed_history,revision,jinn_id').single();
  if(error||!data)throw new Error('This wish changed in another session. Reload it before saving again.');
  return data as FirstWishRow;
}

export async function deleteFirstWish(id:string):Promise<void>{
  const user=await getAuthenticatedUser();
  const {data,error}=await getSupabase().from('wishes').delete().eq('id',id).eq('user_id',user.id).select('id');
  if(error||!data?.length)throw error||new Error('This wish could not be deleted.');
}
