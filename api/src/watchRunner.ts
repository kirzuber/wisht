import { createClient } from '@supabase/supabase-js';
import { scanPhotoOpportunities, type PhotoGenre, type Opportunity } from './scout.js';
import { diffWatchResults } from './watchDiff.js';

export type ClaimedWatch={
  id:string;wish_id:string;user_id:string;
  genre:PhotoGenre;free_only:boolean;status:string;
  check_count:number;expires_at:string
};
export type WatchRuntimeResult={claimed:number;succeeded:number;failed:number;newListings:number;changedListings:number};

function serverClient(){
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)throw new Error('Watch worker disabled: server-only Supabase credentials are missing.');
 // Secret is NEVER referenced in the frontend, returned to a caller, or logged.
 return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function runDuePhotoWatches(
 db=serverClient(),
 scan=scanPhotoOpportunities
):Promise<WatchRuntimeResult>{
 const {data:claimed,error:claimError}=await db.rpc('claim_due_photo_watches',{p_limit:6});
 if(claimError)throw new Error('Could not atomically reserve due watch checks.');
 const jobs=(claimed||[]) as ClaimedWatch[];
 const tally:WatchRuntimeResult={claimed:jobs.length,succeeded:0,failed:0,newListings:0,changedListings:0};
 const processOne=async(w:ClaimedWatch)=>{
  // Confirm current status in case user paused/cancelled after reservation.
  const {data:live,error:readError}=await db.from('photo_watches')
   .select('status').eq('id',w.id).single();
  if(readError||live?.status!=='active')return;
  try{
   const scout=await scan({genre:w.genre,freeOnly:w.free_only});
   const {data:history,error:historyError}=await db.from('photo_watch_runs')
    .select('matches').eq('watch_id',w.id).eq('state','succeeded')
    .order('checked_at',{ascending:false}).limit(7);
   if(historyError)throw historyError;
   const past=(history||[]).map((r:{matches:Opportunity[]})=>r.matches);
   const diff=diffWatchResults(scout.opportunities,past);
   const {error:writeError}=await db.from('photo_watch_runs').insert({
    watch_id:w.id,user_id:w.user_id,wish_id:w.wish_id,
    state:'succeeded',matches:scout.opportunities,
    new_matches:diff.newMatches,changed_matches:diff.changedMatches
   });
   if(writeError)throw writeError;
   tally.succeeded++;tally.newListings+=diff.newMatches.length;
   tally.changedListings+=diff.changedMatches.length;
  }catch(err){
   // Persist an honest failed check, but do not fabricate matches or receipts.
   const message=err instanceof Error?err.message.slice(0,240):'Source unavailable';
   const {error:failureError}=await db.from('photo_watch_runs').insert({
    watch_id:w.id,user_id:w.user_id,wish_id:w.wish_id,
    state:'failed',error_message:message,
    matches:[],new_matches:[],changed_matches:[]
   });
   if(failureError)throw new Error('Could not record watch failure.');
   tally.failed++;
  }
 };
 // Max 6 watches, two groups of 3; each source check has a 7.5s timeout.
 for(let i=0;i<jobs.length;i+=3)await Promise.all(jobs.slice(i,i+3).map(processOne));
 return tally;
}
