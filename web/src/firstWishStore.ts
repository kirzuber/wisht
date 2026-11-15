import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import type { Artifact, DeedReceipt } from '../../api/src/firstDeed';

export type WishSummary = { id:string; aspiration:string; updated_at:string; state:string };
export type FirstWishRow = { id:string; aspiration:string; first_artifact:Artifact; first_deed:DeedReceipt;
  deed_history:DeedReceipt[]; revision:number; jinn_id:string; artifact_id:string };

export async function listFirstWishes():Promise<WishSummary[]> {
  const user=await getAuthenticatedUser();
  const {data,error}=await getSupabase().from('wishes').select('id,original_intent,updated_at,state')
    .eq('user_id',user.id).order('updated_at',{ascending:false});
  if(error)throw error;
  return (data||[]).map(item=>({id:item.id,aspiration:item.original_intent,updated_at:item.updated_at,state:item.state}));
}

export async function loadFirstWish(id:string):Promise<FirstWishRow> {
  const user=await getAuthenticatedUser();
  const db=getSupabase();
  const {data:wish,error:wishError}=await db.from('wishes').select('id,original_intent,primary_jinn_id')
    .eq('id',id).eq('user_id',user.id).single();
  if(wishError||!wish)throw new Error('This saved wish is unavailable.');
  const [{data:artifacts,error:artifactError},{data:deeds,error:deedError}]=await Promise.all([
    db.from('artifacts').select('id,content,version,origin_deed_id').eq('wish_id',id).eq('user_id',user.id)
      .order('updated_at',{ascending:false}).limit(1),
    db.from('deeds').select('id,receipt,created_at').eq('wish_id',id).eq('user_id',user.id)
      .order('created_at',{ascending:true}).order('id',{ascending:true})
  ]);
  if(artifactError||deedError||!artifacts?.length||!deeds?.length)
    throw new Error('This saved wish has no prepared Deed.');
  const artifact=artifacts[0];
  const current=deeds.find(deed=>deed.id===artifact.origin_deed_id)||deeds[deeds.length-1];
  return {id:wish.id,aspiration:wish.original_intent,first_artifact:artifact.content as Artifact,
    first_deed:current.receipt as DeedReceipt,deed_history:[...deeds.filter(deed=>deed.id!==current.id).map(deed=>deed.receipt as DeedReceipt),current.receipt as DeedReceipt],
    revision:artifact.version,jinn_id:wish.primary_jinn_id,artifact_id:artifact.id};
}

async function primaryJinn(userId:string):Promise<string>{
  const db=getSupabase();
  const {data:found,error:readError}=await db.from('jinns').select('id').eq('user_id',userId)
    .eq('is_primary',true).maybeSingle();
  if(readError)throw readError;
  if(found)return found.id;
  const {data:created,error:createError}=await db.from('jinns').insert({user_id:userId,is_primary:true,name:'Jinn'})
    .select('id').single();
  if(created)return created.id;
  // Concurrent tabs can race to create the primary Jinn; the unique index resolves it.
  const {data:concurrent,error:retryError}=await db.from('jinns').select('id').eq('user_id',userId)
    .eq('is_primary',true).single();
  if(retryError||!concurrent)throw createError||retryError||new Error('Could not start your Jinn.');
  return concurrent.id;
}

export async function saveFirstWish(wish:string,artifact:Artifact,receipt:DeedReceipt):Promise<FirstWishRow>{
  const user=await getAuthenticatedUser();
  const db=getSupabase();
  const jinnId=await primaryJinn(user.id);
  const {data,error}=await db.rpc('create_wish_with_deed',{
    p_jinn_id:jinnId,p_intent:wish,p_artifact:artifact,p_receipt:receipt
  });
  if(error||!data)throw error||new Error('Could not save your wish.');
  return loadFirstWish(data as string);
}

/** The database checks the artifact version and records a follow-up Deed atomically. */
export async function updateFirstWish(row:FirstWishRow,artifact:Artifact,receipt?:DeedReceipt):Promise<FirstWishRow>{
  await getAuthenticatedUser();
  const db=getSupabase();
  const args=receipt?{
    p_wish_id:row.id,p_artifact_id:row.artifact_id,p_expected_version:row.revision,
    p_artifact:artifact,p_receipt:receipt
  }:{p_artifact_id:row.artifact_id,p_expected_version:row.revision,p_content:artifact};
  const {error}=receipt?await db.rpc('append_prepared_deed',args):await db.rpc('correct_artifact',args);
  if(error)throw new Error(error.message.includes('changed')?'This wish changed in another session. Reload it before saving again.':error.message);
  return loadFirstWish(row.id);
}

export async function deleteFirstWish(id:string):Promise<void>{
  const user=await getAuthenticatedUser();
  const {data,error}=await getSupabase().from('wishes').delete().eq('id',id).eq('user_id',user.id).select('id');
  if(error||!data?.length)throw error||new Error('This wish could not be deleted.');
}
