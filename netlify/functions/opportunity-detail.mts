import type { Config } from '@netlify/functions';
import { inspectIndexedListing } from '../../api/src/contestEvidence.js';
export default async(req:Request)=>{
 if(req.method!=='GET')return Response.json({error:'Method not allowed'},{status:405});
 const listing=new URL(req.url).searchParams.get('listing')||'';
 try{
  const evidence=await inspectIndexedListing(listing);
  return Response.json(evidence,{headers:{
   'Cache-Control':'public,max-age=60,s-maxage=300',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch(e){
  return Response.json({error:e instanceof Error?e.message:'Could not inspect listing.'},{status:422});
 }
};
export const config:Config={
 path:'/api/opportunity-detail',
 rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:6}
};
