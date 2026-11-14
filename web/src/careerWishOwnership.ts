import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { wishesRemaining } from './wishLimit';
import type { WishLink } from './wishOwnership';

export async function ensureCareerWish(context:{
 wishId?:string;aspiration?:string;answer?:string
}):Promise<WishLink>{
 const user=await getAuthenticatedUser();
 const db=getSupabase();
 const lookup=async()=> {
  const {data,error}=await db.from('wishes').select('id,kind')
   .eq('user_id',user.id);
  if(error)throw error;
  return data||[];
 };
 const roots=await lookup();
 if(context.wishId){
  const record=roots.find(r=>r.id===context.wishId);
  if(!record||record.kind!=='career')throw new Error('Choose your existing career wish.');
  return {wishId:record.id,created:false};
 }
 const existing=roots.find(r=>r.kind==='career');
 if(existing)return {wishId:existing.id,created:false};
 if(wishesRemaining(roots.length)<1)
  throw new Error('All three wish slots are already in use. Free one before saving a career wish.');
 const {data,error}=await db.from('wishes').insert({
   user_id:user.id,aspiration:context.aspiration?.trim()||'I want a new career',
   kind:'career',mission_id:'career-scout',answer:context.answer||'advance',status:'PLANNED'
 }).select('id').single();
 if(error){
  if(error.message.includes('WISH_ALREADY_EXISTS')){
   const current=(await lookup()).find(r=>r.kind==='career');
   if(current)return {wishId:current.id,created:false};
  }
  if(error.message.includes('WISH_LIMIT_REACHED'))
   throw new Error('All three wish slots are in use.');
  throw error;
 }
 if(!data)throw new Error('Could not confirm your career wish.');
 return {wishId:data.id as string,created:true};
}
