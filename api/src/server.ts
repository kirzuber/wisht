import express from 'express';
import cors from 'cors';
import { serveFirstDeed } from './firstDeed.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'40kb'}));
if(process.env.CORS_ORIGIN)app.use(cors({origin:process.env.CORS_ORIGIN}));
app.get('/api/health',(_req,res)=>res.json({
  status:'ok',story:'JINN-F03-004',
  // Only local Supabase development exposes setup readiness; no secret values.
  ...(process.env.VITE_SUPABASE_URL==='http://127.0.0.1:54321'?
    {localFirstValueSigningReady:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.length>=32)}:{}),
}));
app.post('/api/first-deed',async(req,res)=>{
 const request=new Request('http://localhost/api/first-deed',{method:'POST',
  headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},
  body:JSON.stringify(req.body)});
 const response=await serveFirstDeed(request);
 res.status(response.status).json(await response.json());
});
const retired=['/api/interpret','/api/examples','/api/scout','/api/opportunity-detail','/api/career-scout','/api/soccer-scout'];
app.all(retired,(_req,res)=>res.status(410).json({error:'This specialized tool was retired. Start a new Wish with Jinn.'}));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
 res.status(400).json({error:err instanceof Error&&err.message.includes('entity')?'Request too large or malformed.':'Invalid request.'});
});
const port=Number(process.env.PORT||3001);
app.listen(port,()=>{
  console.log(`Jinn API ready on http://localhost:${port}`);
  if(process.env.VITE_SUPABASE_URL==='http://127.0.0.1:54321' &&
    (!process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY.length<32))
    console.error('[Wisht] LOCAL API STARTED WITHOUT FIRST-VALUE SIGNING KEY. Run npm run dev from the repository root; do not add this key to web/.env.local.');
});
