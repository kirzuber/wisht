import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { callFirstDeedModel, planFirstValue, prepareDeed, validateArtifact, type Artifact } from './firstDeed.js';
import { validateExperiencePlan } from './experiencePlan.js';
import type { Locale } from './locale.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Snapshot={sourceId:string;sourceVersion:number;contextRevision:number;actorId:string;latestDeedId:string};
type TrustedContext={sourceNote:string;sourceNoteConfirmed:boolean;confirmedFacts:string[];unknowns:string[]};
export class ContinuationError extends Error {
  constructor(message:string,readonly status:number,readonly code:string){super(message);}
}
const fail=(message:string,status:number,code:string):never=>{throw new ContinuationError(message,status,code);};
const strings=(value:unknown,maxItems=6):string[]=>Array.isArray(value)?
  value.filter((item):item is string=>typeof item==='string'&&item.length>0&&item.length<=180).slice(0,maxItems):[];
const secret=(env:NodeJS.ProcessEnv)=>{
  if(!env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_ROLE_KEY.length<32)
    return fail('Verified continuation is unavailable.',503,'save_not_configured');
  return env.SUPABASE_SERVICE_ROLE_KEY;
};
function signature(value:unknown,env:NodeJS.ProcessEnv):string{
  return createHmac('sha256',secret(env)).update('wisht-continuation-v1\n')
    .update(JSON.stringify(value)).digest('base64url');
}
function verify(value:unknown,proof:unknown,env:NodeJS.ProcessEnv):void{
  if(typeof proof!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(proof))
    fail('Review this Deed again.',409,'proposal_stale');
  const expected=signature(value,env);
  if(!timingSafeEqual(Buffer.from(expected),Buffer.from(proof as string)))
    fail('Review this Deed again.',409,'proposal_stale');
}
function clients(env:NodeJS.ProcessEnv){
  if(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_PUBLISHABLE_KEY)
    return fail('Saved Wishes are unavailable.',503,'database_not_configured');
  return {
    auth:createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false}}),
    admin:createClient(env.VITE_SUPABASE_URL,secret(env),
      {auth:{persistSession:false,autoRefreshToken:false}}),
  };
}
async function identity(token:string,env:NodeJS.ProcessEnv){
  const db=clients(env);
  const {data:{user},error}=await db.auth.auth.getUser(token);
  if(error||!user||user.is_anonymous||!user.email_confirmed_at)
    fail('Sign in to continue this Wish.',401,'auth_required');
  return {user:user!,admin:db.admin};
}
async function snapshot(token:string,wishId:string,sourceId:string|undefined,env:NodeJS.ProcessEnv){
  if(!uuid.test(wishId)||(sourceId&&!uuid.test(sourceId)))
    fail('Invalid Wish or Artifact.',400,'invalid_request');
  const {user,admin}=await identity(token,env);
  const {data:wish,error:wishError}=await admin.from('wish_records')
    .select('id,original_intent,primary_jinn_id,wish_context')
    .eq('id',wishId).eq('user_id',user.id).maybeSingle();
  if(wishError||!wish)fail('Saved Wish unavailable.',404,'wish_not_found');
  const {data:jinn}=await admin.from('jinns').select('id,name,settings')
    .eq('id',wish!.primary_jinn_id).eq('user_id',user.id).maybeSingle();
  if(!jinn)fail('Assigned Jinn unavailable.',409,'jinn_changed');
  let sourceQuery=admin.from('artifacts').select('id,content,version,origin_deed_id')
    .eq('wish_id',wishId).eq('user_id',user.id);
  sourceQuery=sourceId?sourceQuery.eq('id',sourceId):sourceQuery.order('created_at',{ascending:false}).limit(1);
  const {data:source,error:sourceError}=await sourceQuery.maybeSingle();
  if(sourceError||!source)fail('Source Artifact unavailable.',404,'artifact_not_found');
  const {data:latest,error:deedError}=await admin.from('deeds').select('id')
    .eq('wish_id',wishId).eq('user_id',user.id)
    .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
  if(deedError||!latest)fail('Saved Deed unavailable.',404,'deed_not_found');
  const raw=wish!.wish_context as Record<string,unknown>||{};
  const context:TrustedContext={
    sourceNote:typeof raw.sourceNote==='string'?raw.sourceNote.slice(0,500):'',
    sourceNoteConfirmed:raw.sourceNoteConfirmed===true,
    confirmedFacts:strings(raw.confirmedFacts),unknowns:strings(raw.unknowns),
  };
  const revision=Number.isInteger(raw.revision)?Number(raw.revision):0;
  const version:Snapshot={sourceId:source!.id,sourceVersion:source!.version,
    contextRevision:revision,actorId:jinn!.id,latestDeedId:latest!.id};
  const content=validateArtifact(source!.content,typeof source!.content?.sourceNote==='string'?source!.content.sourceNote:'');
  const priorDraft={title:content.title,excerpt:content.sections.filter(s=>s.type==='document')
    .map(s=>s.body).join('\n').slice(0,1000),nextDeedTitle:content.nextDeed.title};
  return {user,admin,wish:wish!,jinn:jinn!,context,version,priorDraft};
}
function sameVersion(a:Snapshot,b:Snapshot){
  return a.sourceId===b.sourceId&&a.sourceVersion===b.sourceVersion&&
    a.contextRevision===b.contextRevision&&a.actorId===b.actorId&&a.latestDeedId===b.latestDeedId;
}
async function resolve(admin:ReturnType<typeof clients>['admin'],userId:string,key:string){
  const {data:deed,error}=await admin.from('deeds').select('id,wish_id,receipt')
    .eq('user_id',userId).eq('request_key',key).eq('verified_followup',true).maybeSingle();
  if(error)fail('Could not check the previous save.',503,'resolve_failed');
  if(!deed)return null;
  const {data:artifact, error:artifactError}=await admin.from('artifacts').select('id')
    .eq('origin_deed_id',deed.id).eq('wish_id',deed.wish_id).eq('user_id',userId).single();
  if(artifactError||!artifact)fail('Saved Artifact unavailable.',503,'resolve_failed');
  return {deedId:deed.id,artifactId:artifact!.id,receipt:deed.receipt,replayed:true,wishId:deed.wish_id};
}

export async function serveContinuation(body:Record<string,unknown>,token:string,locale:Locale,
  env:NodeJS.ProcessEnv=process.env):Promise<unknown>{
  const mode=body.mode;
  const fields=mode==='propose_continuation'?['mode','locale','wishId','sourceId','editRequest']:
    mode==='execute_continuation'?['mode','locale','wishId','sourceId','requestKey','proposal','editRequest']:
    mode==='resolve_continuation'?['mode','locale','wishId','requestKey']:[];
  if(!fields.length||Object.keys(body).some(key=>!fields.includes(key)))
    fail('Unsupported continuation field.',400,'invalid_request');
  if(mode==='resolve_continuation'){
    if(typeof body.requestKey!=='string'||!uuid.test(body.requestKey)||
      typeof body.wishId!=='string'||!uuid.test(body.wishId))
      fail('Invalid request key.',400,'invalid_request');
    const {user,admin}=await identity(token,env);
    const existing=await resolve(admin,user.id,body.requestKey as string);
    if(!existing)fail('No completed Deed for this request.',404,'not_saved');
    if(existing!.wishId!==body.wishId)fail('Request key belongs to another Wish.',409,'request_conflict');
    return existing;
  }
  if(typeof body.wishId!=='string'||!uuid.test(body.wishId)||
     (body.sourceId!==undefined&&(typeof body.sourceId!=='string'||!uuid.test(body.sourceId))))
    fail('Invalid Wish or Artifact.',400,'invalid_request');
  if(body.editRequest!==undefined&&(typeof body.editRequest!=='string'||body.editRequest.length>280))
    fail('Edit request is too long.',400,'invalid_request');
  if(mode==='execute_continuation' && (typeof body.requestKey!=='string'||!uuid.test(body.requestKey)))
    fail('Invalid request key.',400,'invalid_request');
  const state=await snapshot(token,body.wishId as string,body.sourceId as string|undefined,env);
  if(state.context.sourceNote&&!state.context.sourceNoteConfirmed)
    fail('Confirm the source note before continuing.',409,'source_confirmation_required');
  if(mode==='propose_continuation'){
    const editRequest=typeof body.editRequest==='string'?body.editRequest.trim():'';
    const evidence={confirmedUserContext:state.context,priorAiDraft:state.priorDraft,
      requestedEmphasis:editRequest,capabilities:['private_draft','local_edit','account_save']};
    const plan=await planFirstValue(state.wish.original_intent,locale,state.jinn.name,
      typeof state.jinn.settings?.purpose==='string'?state.jinn.settings.purpose:'',
      callFirstDeedModel,evidence);
    const value={userId:state.user.id,wishId:state.wish.id,plan,snapshot:state.version,editRequest,
      expires:Date.now()+30*60*1000};
    return {plan,snapshot:state.version,editRequest,expires:value.expires,proof:signature(value,env)};
  }
  if(mode!=='execute_continuation')fail('Invalid request.',400,'invalid_request');
  const key=body.requestKey as string;
  const existing=await resolve(state.admin,state.user.id,key);
  if(existing){
    if(existing.wishId!==state.wish.id)fail('Request key belongs to another Wish.',409,'request_conflict');
    return existing;
  }
  const raw=body.proposal as Record<string,unknown>|undefined;
  if(!raw||typeof raw!=='object'||!raw.snapshot||typeof raw.editRequest!=='string'||
     raw.editRequest!==((typeof body.editRequest==='string'?body.editRequest.trim():''))||
     typeof raw.expires!=='number'||
     raw.expires<Date.now()||raw.expires>Date.now()+30*60*1000+60000)
    fail('Review this Deed again.',409,'proposal_stale');
  const plan=validateExperiencePlan(raw!.plan,locale);
  const version=raw!.snapshot as Snapshot;
  if(!sameVersion(version,state.version))fail('Wish context or Jinn changed. Review again.',409,'proposal_stale');
  verify({userId:state.user.id,wishId:state.wish.id,plan,snapshot:version,
    editRequest:raw!.editRequest,expires:raw!.expires},raw!.proof,env);
  const started=Date.now();
  const prepared=await prepareDeed(state.wish.original_intent,state.context.sourceNote,null,
    undefined,undefined,locale,plan,{},
    {confirmedFacts:state.context.confirmedFacts,unknowns:state.context.unknowns,
      priorDraft:state.priorDraft,editRequest:typeof body.editRequest==='string'?body.editRequest:''});
  const artifact:Artifact=prepared.artifact;
  if(artifact.sourceNote!==state.context.sourceNote||!artifact.experience)
    fail('Prepared Artifact did not match approved context.',422,'draft_invalid');
  const {data,error}=await state.admin.rpc('create_verified_continuation',{
    p_user_id:state.user.id,p_wish_id:state.wish.id,
    p_source_artifact_id:version.sourceId,p_source_version:version.sourceVersion,
    p_context_revision:version.contextRevision,p_expected_actor_id:version.actorId,
    p_latest_deed_id:version.latestDeedId,
    p_request_key:key,p_artifact:artifact,p_draft_source:prepared.receipt.draftSource,
  });
  if(error){
    if(error.code==='40001')fail('Wish context or Artifact changed. Review again.',409,'proposal_stale');
    if(error.code==='23505'){
      const replay=await resolve(state.admin,state.user.id,key);
      if(replay?.wishId===state.wish.id)return replay;
      fail('Request key belongs to another Wish.',409,'request_conflict');
    }
    console.error('[Wisht] api continuation.save.failed',{code:error.code||'db_error'});
    fail('Could not confirm whether the Deed was saved. Retry with the same request.',503,'save_ambiguous');
  }
  console.info('[Wisht] api continuation.completed',{latencyMs:Date.now()-started,
    draftSource:prepared.receipt.draftSource,modelCalls:prepared.receipt.draftSource==='repaired_model'?4:2});
  return {...data,wishId:state.wish.id};
}
