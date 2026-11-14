import { findSoccerClubs,validateSoccerInput } from './soccerCatalogue.js';
export async function serveSoccerScout(request:Request):Promise<Response>{
 if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const raw=await request.text();
  if(raw.length>800)return Response.json({error:'Request too long.'},{status:413});
  const input=validateSoccerInput(JSON.parse(raw) as unknown);
  return Response.json(findSoccerClubs(input),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){
  return Response.json({error:e instanceof Error?e.message:'Could not check soccer clubs.'},{status:422,headers:{'Cache-Control':'no-store'}});
 }
}
