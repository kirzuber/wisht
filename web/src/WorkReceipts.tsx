import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Database } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { receiptDisplay, type WorkReceipt } from './workReceiptModel';
import './workReceipts.css';

type Props = { wishId?: string; portfolioId?: string; refreshKey?: number };

export default function WorkReceipts({ wishId, portfolioId, refreshKey=0 }: Props) {
  const [events,setEvents]=useState<WorkReceipt[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    const filter=portfolioId?'portfolio_id':'wish_id';
    const value=portfolioId || wishId;
    if(!value){setEvents([]);setLoading(false);return;}
    let active=true;
    const load=async()=>{
      setError('');setLoading(true);
      try{
        await getAuthenticatedUser();
        const {data,error:queryError}=await getSupabase().from('work_receipts')
          .select('id,wish_id,portfolio_id,shortlist_id,submission_id,opportunity_count,action,photo_count,public_slug,source,recorded_at')
          .eq(filter,value).order('recorded_at',{ascending:false}).limit(20);
        if(queryError)throw queryError;
        if(active)setEvents((data||[]) as WorkReceipt[]);
      }catch(cause){
        if(active)setError(cause instanceof Error?cause.message:'Could not load work receipts.');
      }finally{if(active)setLoading(false);}
    };
    void load();
    return()=>{active=false;};
  },[wishId,portfolioId,refreshKey]);

  return <section className="work-receipts" aria-label="Work receipts">
    <header className="work-receipts-heading">
      <ClipboardCheck size={18}/>
      <div><strong>Work Receipts</strong><small>Evidence of completed database operations</small></div>
    </header>
    {loading?<p className="receipt-muted">Checking recorded work…</p> :
      error?<p className="error" role="alert">{error}</p>:
      events.length===0?<p className="receipt-muted">No completed actions have been recorded yet.</p>:
      <ol className="receipt-history">{events.map(event=>{
        const detail=receiptDisplay(event);
        return <li key={event.id}>
          <CheckCircle2 size={15} className="receipt-check"/>
          <div className="receipt-event">
            <strong>{detail.title}</strong>
            <p>{detail.detail}</p>
            <small>{detail.privacy}</small>
            <div className="receipt-evidence">
              <Database size={12}/>
              <span>{event.source==='database_event'?'Database event confirmed':'Reconstructed from an existing database record'}</span>
              <span>·</span><time dateTime={event.recorded_at}>{new Date(event.recorded_at).toLocaleString()}</time>
              <span>·</span><span>{event.public_slug
                ? `Listing ID: ${event.public_slug}`
                : event.submission_id ? `Draft ID: ${event.submission_id.slice(0,8)}` : event.shortlist_id ? `Research ID: ${event.shortlist_id.slice(0,8)}` : event.portfolio_id ? `Gallery ID: ${event.portfolio_id.slice(0,8)}` : 'Wish-level deed'}</span>
            </div>
          </div>
        </li>;
      })}</ol>}
    <p className="receipt-disclaimer">Receipts confirm the stored database events, not ongoing image availability or external delivery.</p>
  </section>;
}
