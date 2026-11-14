import { createClient } from '@supabase/supabase-js';
import { findRemoteCareerJobs, validateCareerInput } from './careerJobs.js';
import { assessCareerJobs } from './careerReasoning.js';
export async function serveCareerScout(request:Request):Promise<Response>{
 if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const text=await request.text();
  if(text.length>2500)return Response.json({error:'Request too long'},{status:413});
  const input=validateCareerInput(JSON.parse(text) as unknown);
  if(input.allowAi){
   const bearer=request.headers.get('authorization')||'';
   const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
   if(!token)return Response.json({error:'Sign in to request AI matching.'},{status:401});
   const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
   const pub=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
   if(!url||!pub)return Response.json({error:'AI matching authentication is not configured.'},{status:503});
   const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await auth.auth.getUser(token);
   if(error||!data.user||data.user.is_anonymous||!data.user.email_confirmed_at)
    return Response.json({error:'Verified sign-in required for AI matching.'},{status:401});
  }
  const result=await findRemoteCareerJobs(input);
  if(input.allowAi&&result.jobs.length){
   const assessment=await assessCareerJobs(input,result.jobs);
   result.jobs=assessment.jobs;
   result.aiStatus=assessment.status;
   result.aiUsed=assessment.status==='completed';
  }
  return Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){
  return Response.json({error:e instanceof Error?e.message:'Career scout unavailable.'},{status:422,headers:{'Cache-Control':'no-store'}});
 }
}
