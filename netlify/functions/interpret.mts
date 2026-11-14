import type { Config } from '@netlify/functions';
import { interpretWishSmart } from '../../api/src/llm.js';
export default async (request:Request)=>{
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
  try{
    if(Number(request.headers.get('content-length')||'0')>4096)return Response.json({error:'Request too large'},{status:413});
    const body=await request.text();
    if(body.length>4096)return Response.json({error:'Request too large'},{status:413});
    const wish=(JSON.parse(body) as {wish?:unknown}).wish;
    if(typeof wish!=='string'||wish.trim().length<2||wish.length>280)return Response.json({error:'Write a wish between 2 and 280 characters.'},{status:400});
    const {interpretation,route}=await interpretWishSmart(wish);
    return Response.json({interpretation,route,execution:{status:'NOT_STARTED',wishesUsed:0}});
  }catch{return Response.json({error:'Invalid request'},{status:400});}
};
export const config:Config={path:'/api/interpret',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:12}};
