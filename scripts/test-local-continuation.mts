/** Optional acceptance check: run only against the local Supabase CLI stack. */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadOwnedWish } from '../api/src/firstDeed.ts';

const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url?.startsWith('http://127.0.0.1:54321')||!key)throw new Error('Refusing non-local Supabase URL.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`f03-continuation-${Date.now()}@example.test`;
const inbox='http://127.0.0.1:54324/api/v1/messages';
const before=new Set((await (await fetch(inbox)).json()).messages.map((message:{ID:string})=>message.ID));
const {error:sendError}=await client.auth.signInWithOtp({email});
if(sendError)throw sendError;
let otp='';
for(let attempt=0;attempt<40;attempt++){
 const messages=(await (await fetch(inbox)).json()).messages as Array<{ID:string;To:Array<{Address:string}>}>;
 const message=messages.find(item=>!before.has(item.ID)&&item.To.some(address=>address.Address===email));
 if(message){const details=await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
  otp=String(details.HTML).match(/<strong>(\d{6})<\/strong>/)?.[1]||'';if(otp)break;}
 await new Promise(resolve=>setTimeout(resolve,250));
}
if(!otp)throw new Error('Local OTP missing.');
const {data:verified,error:verifyError}=await client.auth.verifyOtp({email,token:otp,type:'email'});
if(verifyError||!verified.user||!verified.session)throw verifyError||new Error('Local sign-in failed.');
const user=verified.user;
const {data:jinn,error:jinnError}=await client.from('jinns').insert({user_id:user.id,is_primary:true}).select('id').single();
if(jinnError||!jinn)throw jinnError||new Error('Jinn creation failed.');
const artifact={title:'Clock observation kit',sourceNote:'Hands do not move',sections:[{type:'document',title:'Condition log',body:'Record visible condition before touching it.'}],unknowns:['Cause is unknown'],nextDeed:{title:'Observe the hands',why:'It gives a baseline.',prompt:'Write what you see.'},boundary:'No repair or diagnosis was performed.'};
const receipt={status:'PREPARED',operation:'AI generated and checked an editable draft against supplied facts',recordedAt:new Date().toISOString(),scope:'Private draft only.'};
const {data:wishId,error:saveError}=await client.rpc('create_wish_with_deed',{p_jinn_id:jinn.id,p_intent:'Repair an old clock',p_artifact:artifact,p_receipt:receipt});
if(saveError||!wishId)throw saveError||new Error('Wish save failed.');
try{
 const owned=await loadOwnedWish(verified.session.access_token,wishId,{VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:key} as NodeJS.ProcessEnv);
 assert.equal(owned.wish,'Repair an old clock');assert.equal(owned.artifact.sourceNote,'Hands do not move');
 const {data:artifactRow,error:readError}=await client.from('artifacts').select('id,version').eq('wish_id',wishId).single();
 if(readError||!artifactRow)throw readError||new Error('Artifact missing.');
 const {error:editError}=await client.rpc('correct_artifact',{p_artifact_id:artifactRow.id,p_expected_version:artifactRow.version,p_content:{...artifact,sourceNote:'Hands move briefly'}});
 if(editError)throw editError;
 const corrected=await loadOwnedWish(verified.session.access_token,wishId,{VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:key} as NodeJS.ProcessEnv);
 assert.equal(corrected.artifact.sourceNote,'Hands move briefly');
 const otherEmail=`f03-other-${Date.now()}@example.test`;
 const other=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const seen=new Set((await (await fetch(inbox)).json()).messages.map((message:{ID:string})=>message.ID));
 const {error:otherSend}=await other.auth.signInWithOtp({email:otherEmail});
 if(otherSend)throw otherSend;
 let otherOtp='';
 for(let attempt=0;attempt<40;attempt++){
  const messages=(await (await fetch(inbox)).json()).messages as Array<{ID:string;To:Array<{Address:string}>}>;
  const message=messages.find(item=>!seen.has(item.ID)&&item.To.some(address=>address.Address===otherEmail));
  if(message){const details=await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
   otherOtp=String(details.HTML).match(/<strong>(\d{6})<\/strong>/)?.[1]||'';if(otherOtp)break;}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!otherOtp)throw new Error('Second local OTP missing.');
 const {error:otherVerify}=await other.auth.verifyOtp({email:otherEmail,token:otherOtp,type:'email'});
 if(otherVerify)throw otherVerify;
 for(const table of ['jinns','wishes','deeds','artifacts']){
  const {data,error}=await other.from(table).select('id');
  if(error)throw error;assert.equal(data.length,0,`cross-owner ${table} read`);
 }
 const {data:crossDelete,error:crossDeleteError}=await other.from('wishes').delete().eq('id',wishId).select('id');
 if(crossDeleteError)throw crossDeleteError;assert.equal(crossDelete.length,0);
 const {error:crossEdit}=await other.rpc('correct_artifact',{p_artifact_id:artifactRow.id,p_expected_version:2,p_content:{...artifact,sourceNote:'Intruder'}});
 assert.ok(crossEdit,'second account must not edit owner artifact');
 await other.auth.signOut();
 console.log('Local Auth token → server owner read → correction; second account isolation: PASS');
}finally{
 const {error:deleteError}=await client.from('wishes').delete().eq('id',wishId);
 if(deleteError)throw deleteError;
 await client.auth.signOut();
}
