import type { Config } from '@netlify/functions';
import { scanPhotoOpportunities, type PhotoGenre } from '../../api/src/scout.js';
export default async(request:Request)=>{
 if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405});
 const url=new URL(request.url);
 const genre=url.searchParams.get('genre')||'any';
 const free=url.searchParams.get('free')||'true';
 if(!['any','nature','portrait','open'].includes(genre)||!['true','false'].includes(free))
  return Response.json({error:'Choose a supported photography category.'},{status:400});
 try{
  const data=await scanPhotoOpportunities({genre:genre as PhotoGenre,freeOnly:free==='true'});
  return Response.json(data,{headers:{'Cache-Control':'public, max-age=120, s-maxage=600','X-Content-Type-Options':'nosniff'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Scout unavailable.'},{status:503});}
};
export const config:Config={path:'/api/scout',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:6}};
