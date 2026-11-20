import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { logWishOperation, WishPersistenceError } from './wishDiagnostics';
import type { Artifact, DeedReceipt } from '../../api/src/firstDeed';
import { ensurePrimaryJinn } from './jinnStore';

export type WishSummary = { id: string; aspiration: string; updated_at: string; state: string; jinn_id: string };
export type SavedArtifact={id:string;artifact:Artifact;receipt:DeedReceipt;revision:number;
  deedId:string;actorName:string|null;verified:boolean};
export type WishContext={sourceNote:string;sourceNoteConfirmed:boolean;confirmedFacts:string[];unknowns:string[];revision:number};
export type FirstWishRow = {
  id: string;
  aspiration: string;
  first_artifact: Artifact;
  first_deed: DeedReceipt;
  deed_history: Array<DeedReceipt & {verifiedRecord:boolean}>;
  revision: number;
  artifact_id: string;
  jinn_id: string;
  jinn_name: string;
  jinn_purpose: string;
  artifacts:SavedArtifact[];
  context:WishContext;
  latest_deed_id:string;
};

export function listFirstWishes(): Promise<WishSummary[]> {
  return logWishOperation('list', async () => {
    const user = await getAuthenticatedUser();
    const { data, error, status } = await getSupabase().from('wish_records').select('id,original_intent,updated_at,state,primary_jinn_id')
      .eq('user_id', user.id).order('updated_at', { ascending: false });
    if (error) throw new WishPersistenceError('read wishes', error, status);
    return data.map(item => ({
      id: item.id, aspiration: item.original_intent, updated_at: item.updated_at, state: item.state,
      jinn_id: item.primary_jinn_id,
    }));
  });
}

export function loadFirstWish(id: string): Promise<FirstWishRow> {
  return logWishOperation('open', async () => {
    const user = await getAuthenticatedUser();
    const db = getSupabase();
    const wish = await db.from('wish_records').select('id,original_intent,primary_jinn_id,wish_context')
      .eq('id', id).eq('user_id', user.id).maybeSingle();
    if (wish.error) throw new WishPersistenceError('read wish', wish.error, wish.status);
    if (!wish.data) throw new Error('This saved wish is unavailable.');

    // Never silently substitute a default Jinn for an unexpected missing assignment.
    const assigned = await db.from('jinns').select('id,name,settings')
      .eq('id', wish.data.primary_jinn_id).eq('user_id', user.id).maybeSingle();
    if (assigned.error) throw new WishPersistenceError('read assigned Jinn', assigned.error, assigned.status);
    if (!assigned.data) throw new Error('The Jinn assigned to this Wish is unavailable. Open My Jinns and retry.');

    const [artifacts, deeds] = await Promise.all([
      db.from('artifacts').select('id,content,version,origin_deed_id,created_at').eq('wish_id', id).eq('user_id', user.id)
        .order('created_at', { ascending: true }).order('id',{ascending:true}),
      db.from('deeds').select('id,receipt,actor_jinn_name,verified_followup,verified_first').eq('wish_id', id).eq('user_id', user.id)
        .order('created_at', { ascending: true }).order('id', { ascending: true }),
    ]);
    if (artifacts.error) throw new WishPersistenceError('read artifacts', artifacts.error, artifacts.status);
    if (deeds.error) throw new WishPersistenceError('read deeds', deeds.error, deeds.status);
    const artifact = artifacts.data.at(-1);
    const current = deeds.data.find(deed => deed.id === artifact?.origin_deed_id) ?? deeds.data.at(-1);
    if (!artifact || !current) throw new Error('This saved wish has no prepared Deed.');
    const savedArtifacts:SavedArtifact[]=artifacts.data.map(item=>{
      const deed=deeds.data.find(value=>value.id===item.origin_deed_id);
      if(!deed)throw new Error('An Artifact has no matching Deed receipt.');
      return {id:item.id,artifact:item.content as Artifact,receipt:deed.receipt as DeedReceipt,
        revision:item.version,deedId:deed.id,actorName:deed.actor_jinn_name||null,
        verified:deed.verified_followup===true||deed.verified_first===true};
    });
    const raw=wish.data.wish_context as Record<string,unknown>||{};
    const bounded=(value:unknown)=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string').slice(0,6):[];

    return {
      id: wish.data.id,
      aspiration: wish.data.original_intent,
      first_artifact: artifact.content as Artifact,
      first_deed: current.receipt as DeedReceipt,
      deed_history: deeds.data.map(deed=>({...deed.receipt as DeedReceipt,
        verifiedRecord:deed.verified_first===true||deed.verified_followup===true})),
      revision: artifact.version,
      artifact_id: artifact.id,
      jinn_id: assigned.data.id,
      jinn_name: assigned.data.name,
      jinn_purpose: typeof assigned.data.settings?.purpose === 'string' ? assigned.data.settings.purpose : '',
      artifacts:savedArtifacts,
      context:{sourceNote:typeof raw.sourceNote==='string'?raw.sourceNote:'',
        sourceNoteConfirmed:raw.sourceNoteConfirmed===true,
        confirmedFacts:bounded(raw.confirmedFacts),unknowns:bounded(raw.unknowns),
        revision:Number.isInteger(raw.revision)?Number(raw.revision):0},
      latest_deed_id:deeds.data.at(-1)!.id,
    };
  });
}

export function saveFirstWish(wish: string, artifact: Artifact, receipt: DeedReceipt, selectedJinnId?: string): Promise<string> {
  return logWishOperation('save', async () => {
    await getAuthenticatedUser();
    // No selection means default; an explicit selection is enforced by the same-owner FK.
    const jinnId = selectedJinnId || (await ensurePrimaryJinn()).id;
    const { data, error, status } = await getSupabase().rpc('create_wish_with_deed', {
      p_jinn_id: jinnId, p_intent: wish, p_artifact: artifact, p_receipt: receipt,
    });
    if (error || typeof data !== 'string') throw new WishPersistenceError('create_wish_with_deed', error, status);
    return data;
  });
}

/**
 * F03-004: do not let the browser submit an unverified receipt to Supabase.
 * Server checks its signed preparation, caller Auth, and Jinn ownership, and
 * writes Wish/Deed/Artifact atomically with its service-only database function.
 */
export function savePreparedFirstValue(
  wish:string,edited:Artifact,prepared:Artifact,receipt:DeedReceipt,proof:string,
  selectedJinnId?:string,
):Promise<string>{
  return logWishOperation('save',async()=>{
    await getAuthenticatedUser();
    const {data:{session},error:sessionError}=await getSupabase().auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Sign in to save your Wish.');
    const jinnId=selectedJinnId||(await ensurePrimaryJinn()).id;
    const API=import.meta.env.VITE_API_BASE_URL||'';
    let response:Response;
    try{
      response=await fetch(`${API}/api/first-deed`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({mode:'save_first_value',wish,jinnId,preparedArtifact:prepared,
          artifact:edited,receipt,proof}),
      });
    }catch{throw new Error('Could not reach the saving service. Your draft is unchanged.');}
    const payload=await response.json().catch(()=>null);
    if(!response.ok||typeof payload?.wishId!=='string')
      throw new Error('Your First Artifact was not saved. Keep it open and retry.');
    return payload.wishId as string;
  });
}

/** A correction changes only the selected Artifact; source-note edits also advance Wish context. */
export async function updateFirstWish(row: FirstWishRow, artifact: Artifact): Promise<FirstWishRow> {
  await logWishOperation('edit', async () => {
    await getAuthenticatedUser();
    const db = getSupabase();
    const step = 'correct_artifact';
    const { error, status } = await db.rpc(step, {
      p_artifact_id: row.artifact_id, p_expected_version: row.revision, p_content: artifact,
    });
    if (error) {
      if (error.code === 'P0001' && error.message.includes('changed')) {
        throw new Error('This wish changed in another session. Reload it before saving again.');
      }
      throw new WishPersistenceError(step, error, status);
    }
  });
  return loadFirstWish(row.id);
}

export async function saveTrustedContext(row:FirstWishRow,facts:string[],unknowns:string[]):Promise<FirstWishRow>{
  await getAuthenticatedUser();
  const {error,status}=await getSupabase().rpc('set_trusted_wish_context',{
    p_wish_id:row.id,p_expected_revision:row.context.revision,
    p_facts:facts,p_unknowns:unknowns,p_confirm_source:true,
  });
  if(error){
    if(error.code==='40001')throw new Error('Wish context changed in another session. Reload and review again.');
    throw new WishPersistenceError('set_trusted_wish_context',error,status);
  }
  return loadFirstWish(row.id);
}

export function deleteFirstWish(id: string): Promise<void> {
  return logWishOperation('delete', async () => {
    const user = await getAuthenticatedUser();
    const { data, error, status } = await getSupabase().from('wish_records').delete()
      .eq('id', id).eq('user_id', user.id).select('id');
    if (error) throw new WishPersistenceError('delete wish', error, status);
    if (!data.length) throw new Error('This wish could not be deleted.');
  });
}
