import { useEffect, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, ExternalLink, Pause, Play, RefreshCw, ShieldAlert, Square, Trash2 } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import type { Opportunity, PhotoGenre } from './opportunityTypes';
import './photoWatch.css';

type Watch={
 id:string;wish_id:string;genre:PhotoGenre;free_only:boolean;
 status:'active'|'paused'|'cancelled'|'completed';created_at:string;
 expires_at:string;next_check_at:string;check_count:number;last_check_at:string|null;
};
type WatchRun={
 id:string;watch_id:string;checked_at:string;state:'succeeded'|'failed';
 matches:Opportunity[];new_matches:Opportunity[];changed_matches:Opportunity[];
 error_message:string;
};
const genres:[PhotoGenre,string][]=[
 ['any','All photography'],['nature','Nature & wildlife'],
 ['portrait','Portraits'],['open','Open theme']
];
const date=(value:string)=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});

export default function PhotoWatch({wishId,onChange}:{wishId:string;onChange?:()=>void}){
 const [watches,setWatches]=useState<Watch[]>([]);
 const [runs,setRuns]=useState<WatchRun[]>([]);
 const [genre,setGenre]=useState<PhotoGenre>('any');
 const [freeOnly,setFreeOnly]=useState(true);
 const [loading,setLoading]=useState(true);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const [info,setInfo]=useState('');
 const active=watches.find(w=>w.status==='active'||w.status==='paused');
 const latest=active?runs.find(r=>r.watch_id===active.id):runs[0];
 const latestSuccess=active?runs.find(r=>r.watch_id===active.id&&r.state==='succeeded'):
   runs.find(r=>r.state==='succeeded');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const user=await getAuthenticatedUser();
   const db=getSupabase();
   const [a,b]=await Promise.all([
    db.from('photo_watches').select('id,wish_id,genre,free_only,status,created_at,expires_at,next_check_at,check_count,last_check_at')
      .eq('wish_id',wishId).eq('user_id',user.id)
      .order('created_at',{ascending:false}).limit(20),
    db.from('photo_watch_runs').select('id,watch_id,checked_at,state,matches,new_matches,changed_matches,error_message')
      .eq('wish_id',wishId).eq('user_id',user.id)
      .order('checked_at',{ascending:false}).limit(30)
   ]);
   if(a.error)throw a.error;if(b.error)throw b.error;
   setWatches((a.data||[]) as Watch[]);setRuns((b.data||[]) as WatchRun[]);
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not open your watch.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[wishId]);
 const start=async()=>{
  if(working||active)return;
  setWorking(true);setError('');setInfo('');
  try{
   const user=await getAuthenticatedUser();
   const {error:insertError}=await getSupabase().from('photo_watches').insert({
    user_id:user.id,wish_id:wishId,genre,free_only:freeOnly
   });
   if(insertError)throw insertError;
   setInfo('Your seven-day watch is queued. First scheduled check runs on the next daily cycle.');
   await load();onChange?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not create the watch.');}
  finally{setWorking(false);}
 };
 const setStatus=async(w:Watch,status:'active'|'paused'|'cancelled')=>{
  if(working)return;
  if(status==='cancelled'&&!window.confirm('Cancel this watch? It will stop future checks. You can start a new one later.'))return;
  setWorking(true);setError('');setInfo('');
  try{
   const user=await getAuthenticatedUser();
   const {data,error:updateError}=await getSupabase().from('photo_watches')
    .update({status}).eq('id',w.id).eq('user_id',user.id).select('id').single();
   if(updateError||!data)throw updateError||new Error('Could not confirm watch status.');
   setInfo(status==='active'?'Watch resumed for the next scheduled cycle.':status==='paused'?'Watch paused. No further checks until resumed.':'Watch cancelled. No future checks.');
   await load();onChange?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not update the watch.');}
  finally{setWorking(false);}
 };
 const deleteHistory=async(w:Watch)=>{
  if(working||!['cancelled','completed'].includes(w.status))return;
  if(!window.confirm('Remove this stopped watch and its detailed checks? Existing Work Receipts remain.'))return;
  setWorking(true);setError('');
  try{
   const user=await getAuthenticatedUser();
   const {error:deleteError}=await getSupabase().from('photo_watches').delete()
    .eq('id',w.id).eq('user_id',user.id);
   if(deleteError)throw deleteError;
   await load();onChange?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not remove watch history.');}
  finally{setWorking(false);}
 };
 return <section className="photo-watch" aria-label="Photography opportunity watch">
  <div className="photo-watch-head">
   <span className="photo-watch-symbol"><CalendarClock size={18}/></span>
   <div><strong>Autonomous opportunity watch</strong>
    <small>Seven days of limited public-source checks · no submissions</small></div>
   <button type="button" aria-label="Refresh watch" title="Refresh watch" onClick={()=>void load()}
     disabled={working||loading}><RefreshCw size={15}/></button>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  {info&&<p className="photo-watch-info">{info}</p>}
  {loading?<p className="photo-watch-subtle">Checking your watch…</p>:active?<>
   <div className="photo-watch-current">
    <span className="photo-watch-status">{active.status==='active'?'WATCH ACTIVE':'WATCH PAUSED'}</span>
    <strong>{genres.find(g=>g[0]===active.genre)?.[1]||'Photography'} · {active.free_only?'Free-entry listings':'All entry types'}</strong>
    <small>{active.check_count}/7 scheduled attempts · ends {date(active.expires_at)}</small>
    <p>Next check: {active.status==='paused'?'paused':date(active.next_check_at)} (scheduled daily around 12:00 UTC).</p>
    <div className="photo-watch-actions">
     {active.status==='active'?<button type="button" disabled={working}
      onClick={()=>void setStatus(active,'paused')}><Pause size={14}/> Pause</button>:
      <button type="button" disabled={working} onClick={()=>void setStatus(active,'active')}>
       <Play size={14}/> Resume</button>}
     <button type="button" disabled={working} onClick={()=>void setStatus(active,'cancelled')}>
      <Square size={13}/> Cancel</button>
    </div>
   </div>
  </>:<>
   <p className="photo-watch-subtle">Jinn can keep looking while you're away. You'll see new or changed listings here when you return. No emails are sent.</p>
   <label className="photo-watch-label">Photography interest
    <select value={genre} onChange={e=>setGenre(e.target.value as PhotoGenre)} disabled={working}>
     {genres.map(g=><option key={g[0]} value={g[0]}>{g[1]}</option>)}
    </select>
   </label>
   <label className="photo-watch-checkbox">
     <input type="checkbox" checked={freeOnly} onChange={e=>setFreeOnly(e.target.checked)} disabled={working}/>
     Free-entry calendar only
   </label>
   <button type="button" className="photo-watch-start" disabled={working}
    onClick={()=>void start()}><Bell size={15}/> Start seven-day watch</button>
   <p className="photo-watch-disclaimer"><ShieldAlert size={14}/> By starting, you approve up to seven daily checks of the public calendar. Stop any time. No third-party organizer is contacted or verified.</p>
  </>}
  {!loading&&latest&&<div className="photo-watch-history">
   <strong>Latest check · {date(latest.checked_at)}</strong>
   {latest.state==='failed'?<p>Source check failed: {latest.error_message||'Unavailable'}. No opportunities were claimed.</p>:
    <p>{latest.matches.length} indexed listing(s) scanned · {latest.new_matches.length} new · {latest.changed_matches.length} changed.</p>}
  </div>}
  {!loading&&latestSuccess&&<>
   <p className="photo-watch-section-label">{latestSuccess.new_matches.length+latestSuccess.changed_matches.length>0
    ?'NEW OR CHANGED LISTINGS':'CURRENT BASELINE'}</p>
   {(latestSuccess.new_matches.length+latestSuccess.changed_matches.length>0
    ? [...latestSuccess.new_matches,...latestSuccess.changed_matches]
    : latestSuccess.matches).map(m=><div key={m.id} className="photo-watch-finding">
      <strong>{m.title}</strong><small>Listed deadline: {m.deadline} · organizer terms not independently checked</small>
      <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect source <ExternalLink size={12}/></a>
    </div>)}
  </>}
  {!loading&&watches.filter(w=>w.status==='cancelled'||w.status==='completed').map(w=>
    <div key={w.id} className="photo-watch-stopped">
     <span><CheckCircle2 size={14}/> {w.status.toUpperCase()} · {w.check_count} checks</span>
     <button type="button" disabled={working} onClick={()=>void deleteHistory(w)}><Trash2 size={13}/> Remove history</button>
    </div>)}
 </section>;
}
