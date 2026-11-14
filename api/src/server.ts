import express from 'express';
import cors from 'cors';
import { interpretWish, supportedExamples } from './catalog.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'16kb'}));
if(process.env.CORS_ORIGIN) app.use(cors({origin:process.env.CORS_ORIGIN}));

app.get('/api/health', (_req,res)=>res.json({status:'ok',story:'JINN-001'}));
app.get('/api/examples', (_req,res)=>res.json({examples:supportedExamples()}));
app.post('/api/interpret', (req,res)=>{
  const wish=req.body?.wish;
  if(typeof wish !=='string' || wish.trim().length<2 || wish.length>280) {
    res.status(400).json({error:'Write a wish between 2 and 280 characters.'});return;
  }
  res.json({interpretation:interpretWish(wish), execution:{status:'NOT_STARTED',wishesUsed:0,reason:'JINN-001 supports mission selection only. No tools have been executed.'}});
});
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  res.status(400).json({error:err instanceof Error&&err.message.includes('entity')?'Request too large or malformed.':'Invalid request.'});
});
const port=Number(process.env.PORT||3001);
app.listen(port,()=>console.log(`Jinn API ready on http://localhost:${port}`));
