import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {runDuePhotoWatches} from '../src/watchRunner.ts';
import type {ScoutResult, Opportunity} from '../src/scout.ts';
const item=(title:string,slug:string):Opportunity=>({
 id:slug,title,deadline:'2027-09-01',
 sourceUrl:'https://pixcontests.com/'+slug,
 summary:'',feeNote:'not verified',relevance:'photo calendar',
 evidence:'calendar_listing',organizerVerified:false
});
const watch={id:'watch-1',wish_id:'wish-1',user_id:'user-1',
 genre:'any',free_only:true,status:'active',
 check_count:1,expires_at:'2027-11-11T00:00:00Z'};
const result=(items:Opportunity[]):ScoutResult=>({
 source:'pixcontests_calendar',feedUrl:'https://pixcontests.com/calendar/free.ics',
 checkedAt:new Date().toISOString(),opportunities:items,candidateCount:items.length,
 filters:{genre:'any',freeOnly:true},evidenceScope:'indexed only'
});
function fakeDB(prior:Opportunity[][],claimed=[watch]){
 const inserted:Record<string,unknown>[]=[];
 const db={
  rpc:async()=>({data:claimed,error:null}),
  from:(table:string)=>{
   if(table==='photo_watches')return{
    select:()=>({eq:()=>({single:async()=>({data:{status:'active'},error:null})})})
   };
   if(table==='photo_watch_runs')return{
    select:()=>({eq:()=>({eq:()=>({order:()=>({
     limit:async()=>({data:prior.map(matches=>({matches})),error:null})
    })})})}),
    insert:async(record:Record<string,unknown>)=>{
     inserted.push(record);return {error:null};
    }
   };
   throw new Error('Unexpected table '+table);
  }
 };
 return {db,inserted};
}
describe('Scheduled photo watch processor',()=>{
 it('does nothing when nobody opted in',async()=>{
  const {db,inserted}=fakeDB([],[]);
  const out=await runDuePhotoWatches(db as never,
    (async()=>{throw new Error('Should not fetch');}) as never);
  assert.deepEqual(out,{claimed:0,succeeded:0,failed:0,newListings:0,changedListings:0});
  assert.equal(inserted.length,0);
 });
 it('saves true new results only, never invents organizer verification',async()=>{
  const first=item('Older call','old'),newItem=item('New call','new');
  const {db,inserted}=fakeDB([[first]]);
  const out=await runDuePhotoWatches(db as never,
    (async()=>result([first,newItem])) as never);
  assert.equal(out.succeeded,1);
  assert.equal(out.newListings,1);
  assert.equal((inserted[0].new_matches as Opportunity[])[0].sourceUrl,newItem.sourceUrl);
  assert.equal((inserted[0].matches as Opportunity[])[0].organizerVerified,false);
 });
 it('records source failure as failure without false matched opportunities',async()=>{
  const {db,inserted}=fakeDB([]);
  const out=await runDuePhotoWatches(db as never,
    (async()=>{throw new Error('Feed unavailable');}) as never);
  assert.equal(out.failed,1);
  assert.equal(inserted[0].state,'failed');
  assert.deepEqual(inserted[0].new_matches,[]);
 });
});
