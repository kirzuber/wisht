import { createClient } from '@supabase/supabase-js';

/** Explicit private save, using a browser-bound anonymous session. */
export async function saveWish(input:{aspiration:string;kind:string;missionId:string;answer:string}):Promise<void>{
  const url=import.meta.env.VITE_SUPABASE_URL;
  const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Saving is not configured yet. Your wish remains on this page.');
  const client=createClient(url,key);
  const {data:session}=await client.auth.getUser();
  let user=session.user;
  if(!user){const {data,error}=await client.auth.signInAnonymously();if(error)throw error;user=data.user;}
  if(!user)throw new Error('Could not establish a private session.');
  const {error}=await client.from('wishes').insert({user_id:user.id,aspiration:input.aspiration,kind:input.kind,mission_id:input.missionId,answer:input.answer,status:'PLANNED'});
  if(error)throw error;
}
