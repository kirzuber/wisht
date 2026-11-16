import express from 'express';
import cors from 'cors';
import { serveFirstDeed } from './firstDeed.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'16kb'}));
if(process.env.CORS_ORIGIN)app.use(cors({origin:process.env.CORS_ORIGIN}));
app.get('/api/health',(_req,res)=>res.json({status:'ok',story:'JINN-F03-001'}));
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
app.listen(port,()=>console.log(`Jinn API ready on http://localhost:${port}`));
