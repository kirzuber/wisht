import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, RotateCcw, Trash2 } from 'lucide-react';
import JinnAvatar from './JinnAvatar';
import { deleteFirstWish, listFirstWishes, type WishSummary } from './firstWishStore';
import './myWishes.css';

type Props={email:string;onNewWish:()=>void;onOpenFirstWish:(id:string,aspiration:string)=>void};
export default function MyWishes({email,onNewWish,onOpenFirstWish}:Props){
 const [wishes,setWishes]=useState<WishSummary[]|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [deleting,setDeleting]=useState<string|null>(null);
 const refresh=async()=>{
  setLoading(true);setError('');
  try{setWishes(await listFirstWishes());}
  catch(cause){setWishes(null);setError(cause instanceof Error?cause.message:'Could not load saved wishes.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void refresh();},[]);
 const remove=async(id:string)=>{
  if(!window.confirm('Delete this wish, its Deeds and artifacts? This cannot be undone.'))return;
  setDeleting(id);setError('');
  try{await deleteFirstWish(id);setWishes(items=>items?.filter(item=>item.id!==id)??null);}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not delete this wish.');}
  finally{setDeleting(null);}
 };
 return <section className="my-work entrance"><div className="my-work-heading"><JinnAvatar size="large"/>
  <p className="eyebrow">YOUR WISH WORKSPACE</p><h2>Welcome <em>back.</em></h2>
  <p className="my-work-subtitle">Your wishes, drafts, and next steps are here whenever you return.</p>
  <p className="my-work-email"><LockKeyhole size={13}/> Signed in as {email}</p></div>
  <div className="my-work-section-header"><h3>Saved wishes</h3>{!loading&&wishes&&<span>{wishes.length}</span>}</div>
  {error&&<div className="my-work-cap-warning" role="alert">{error} <button type="button" onClick={()=>void refresh()}><RotateCcw size={14}/> Retry</button></div>}
  {loading?<p className="my-work-status">Opening your saved work…</p>:wishes?.length===0?<p className="my-work-empty">No saved wishes yet. Your next one starts with a single sentence.</p>:wishes&&
   <div className="my-work-list">{wishes.map(item=><article className="my-work-card" key={item.id}>
    <button type="button" className="my-work-card-main" onClick={()=>onOpenFirstWish(item.id,item.aspiration)}>
     <span className="my-work-card-text"><span className="my-work-status-label">{item.state.toUpperCase()} · PRIVATE WISH</span><strong>{item.aspiration}</strong><small>Updated {new Date(item.updated_at).toLocaleDateString()}</small></span><ArrowRight size={18}/></button>
    <div className="my-work-details"><button type="button" className="my-work-delete" disabled={deleting===item.id} onClick={()=>void remove(item.id)}><Trash2 size={14}/>{deleting===item.id?'Deleting…':'Delete wish'}</button></div>
   </article>)}</div>}
  <div className="my-work-actions"><button type="button" className="primary" onClick={onNewWish}>Start another wish <ArrowRight size={16}/></button></div>
 </section>;
}
