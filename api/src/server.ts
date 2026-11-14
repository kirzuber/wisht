import express from 'express';
import cors from 'cors';
import { supportedExamples } from './catalog.js';
import { interpretWishSmart } from './llm.js';
import { scanPhotoOpportunities, type PhotoGenre } from './scout.js';
import { inspectIndexedListing } from './contestEvidence.js';
import { serveCareerScout } from './careerService.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'16kb'}));
if(process.env.CORS_ORIGIN) app.use(cors({origin:process.env.CORS_ORIGIN}));

app.get('/api/health', (_req,res)=>res.json({status:'ok',story:'JINN-001'}));
app.get('/api/examples', (_req,res)=>res.json({examples:supportedExamples()}));
app.get('/api/scout',async(req,res)=>{
 const genre=String(req.query.genre||'any'),free=String(req.query.free||'true');
 if(!['any','nature','portrait','open'].includes(genre)||!['true','false'].includes(free)){
  res.status(400).json({error:'Invalid scout preferences.'});return;
 }
 try{res.json(await scanPhotoOpportunities({genre:genre as PhotoGenre,freeOnly:free==='true'}));}
 catch(e){res.status(503).json({error:e instanceof Error?e.message:'Scout unavailable.'});}
});
app.get('/api/opportunity-detail',async(req,res)=>{
 try{
  const listing=String(req.query.listing||'');
  res.json(await inspectIndexedListing(listing));
 }catch(e){res.status(422).json({error:e instanceof Error?e.message:'Could not inspect listing.'});}
});
app.post('/api/career-scout',async(req,res)=>{
 const request=new Request('http://localhost/api/career-scout',{
  method:'POST',headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},
  body:JSON.stringify(req.body)
 });
 const response=await serveCareerScout(request);
 res.status(response.status).json(await response.json());
});
app.post('/api/interpret', async (req,res)=>{
  const wish=req.body?.wish;
  if(typeof wish !=='string' || wish.trim().length<2 || wish.length>280) {
    res.status(400).json({error:'Write a wish between 2 and 280 characters.'});return;
  }
  const { interpretation, route }=await interpretWishSmart(wish);
  res.json({interpretation, route, execution:{status:'NOT_STARTED',wishesUsed:0,reason:'JINN-001 supports mission selection only. No tools have been executed.'}});
});
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  res.status(400).json({error:err instanceof Error&&err.message.includes('entity')?'Request too large or malformed.':'Invalid request.'});
});
const port=Number(process.env.PORT||3001);
app.listen(port,()=>console.log(`Jinn API ready on http://localhost:${port}`));
