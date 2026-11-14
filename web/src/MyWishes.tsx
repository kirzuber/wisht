import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Images, LockKeyhole, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { duplicateWishGroups } from './wishDedup';
import { artifactsForWish } from './wishArtifacts';
import WorkReceipts from './WorkReceipts';
import { MAX_SAVED_WISHES, wishesRemaining } from './wishLimit';
import './myWishes.css';

type SavedWish = {
  id: string;
  aspiration: string;
  kind: string;
  mission_id: string;
  answer: string;
  status: 'PLANNED';
  created_at: string;
};
type SavedPortfolio = {
  id: string;
  wish_id: string;
  published: boolean;
  title: string;
  photos: Array<{ id: string }>;
  status: 'PRIVATE';
  created_at: string;
};
type Props = {
  email: string;
  onOpenPortfolio: (id: string) => void;
  onNewPortfolio: (wishId: string) => void;
  onNewWish: () => void;
};

function readable(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
}

export default function MyWishes({ email, onOpenPortfolio, onNewPortfolio, onNewWish }: Props) {
  const [wishes, setWishes] = useState<SavedWish[]>([]);
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const duplicateGroups = duplicateWishGroups(wishes);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const user = await getAuthenticatedUser();
        const db = getSupabase();
        const [wishResult, portfolioResult] = await Promise.all([
          db.from('wishes').select('id,aspiration,kind,mission_id,answer,status,created_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
          db.from('portfolios').select('id,wish_id,title,photos,status,created_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
        ]);
        if (wishResult.error) throw wishResult.error;
        if (portfolioResult.error) throw portfolioResult.error;
        const galleryIds=(portfolioResult.data || []).map((p:{id:string})=>p.id);
        const publishedResult=galleryIds.length
          ? await db.from('portfolio_publications').select('portfolio_id').in('portfolio_id',galleryIds)
          : {data:[],error:null};
        if (publishedResult.error) throw publishedResult.error;
        const liveIds=new Set((publishedResult.data || []).map((p:{portfolio_id:string})=>p.portfolio_id));
        if (active) {
          setWishes((wishResult.data || []) as SavedWish[]);
          setPortfolios((portfolioResult.data || []).map((p:{id:string})=>({...p,published:liveIds.has(p.id)})) as SavedPortfolio[]);
          const photoWish=(wishResult.data||[]).find((wish:{kind:string})=>wish.kind==='photography');
          setExpanded(previous=>previous??photoWish?.id??null);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load your saved work.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [refresh]);

  const deleteWish = async (wish: SavedWish) => {
    if (artifactsForWish(wish,portfolios).length) {
      setError('Delete the portfolios under this wish before deleting the wish itself.');
      return;
    }
    if (deleting || !window.confirm('Delete this wish? This cannot be undone.')) return;
    setDeleting(wish.id); setError('');
    try {
      await getAuthenticatedUser();
      const { error: deleteError } = await getSupabase().from('wishes').delete().eq('id', wish.id);
      if (deleteError) throw deleteError;
      setWishes(current => current.filter(item => item.id !== wish.id));
      if (expanded === wish.id) setExpanded(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this wish.');
    } finally { setDeleting(null); }
  };

  return <section className="my-work entrance">
    <div className="my-work-heading">
      <div className="portfolio-spark"><Sparkles size={23}/></div>
      <p className="eyebrow">YOUR PRIVATE SPACE</p>
      <h2>My <em>wishes.</em></h2>
      <p className="my-work-subtitle">Your wishes and completed drafts, ready whenever you return.</p>
      <p className="my-work-email"><LockKeyhole size={13}/> Signed in as {email}</p>
    </div>

    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p className="my-work-status">Opening your saved work…</p> : <>
      <div className="my-work-section-header">
        <h3>Saved wishes</h3>
        <span>{wishes.length} / {MAX_SAVED_WISHES}</span>
      </div>
      {wishes.length > MAX_SAVED_WISHES && <p className="my-work-cap-warning">
        You saved more than three wishes before the limit was introduced. They're all preserved.
        Delete {wishes.length - MAX_SAVED_WISHES} or more to make room for another wish.
      </p>}
      {duplicateGroups.length > 0 && <p className="my-work-cap-warning">
        Some saved wishes describe the same goal. Different missions don't need separate wishes.
        Your existing entries are preserved; you can delete duplicate test cards to free up space.
      </p>}
      {wishes.length === MAX_SAVED_WISHES && <p className="my-work-cap-note">
        All three wishes are saved. You can keep exploring, but to save a new one you'll need to delete an existing wish.
      </p>}
      {wishes.length < MAX_SAVED_WISHES && wishes.length > 0 && <p className="my-work-cap-note">
        {wishesRemaining(wishes.length)} {wishesRemaining(wishes.length) === 1 ? 'wish' : 'wishes'} remaining.
      </p>}
      {wishes.length === 0
        ? <p className="my-work-empty">No saved wishes yet. Your next one starts with a single sentence.</p>
        : <div className="my-work-list">{wishes.map(wish=>{
            const owned=artifactsForWish(wish,portfolios);
            const opened=expanded===wish.id;
            return <article className="my-work-card" key={wish.id}>
              <button type="button" className="my-work-card-main" aria-expanded={opened}
                onClick={()=>setExpanded(current=>current===wish.id?null:wish.id)}>
                <span className="my-work-card-text">
                  <span className="my-work-status-label">{owned.length
                    ? `${owned.length} PORTFOLIO${owned.length===1?'':'S'} · WORK SAVED`
                    : 'WISH PLANNED · NO COMPLETED DEEDS'}</span>
                  <strong>{wish.aspiration}</strong>
                  <small>{owned.length
                    ? `${owned.length} portfolio${owned.length===1?'':'s'} · multiple deeds under one wish`
                    : readable(wish.mission_id)}</small>
                </span>
                <ArrowRight size={17} className={opened?'turned':''}/>
              </button>
              {opened && <div className="my-work-details">
                {owned.length>0 && <div className="my-work-nested">
                  <p className="my-work-nested-label">YOUR PORTFOLIOS</p>
                  {owned.map(portfolio=><button type="button"
                    className="my-work-portfolio nested" key={portfolio.id}
                    onClick={()=>onOpenPortfolio(portfolio.id)}>
                    <span className="my-work-portfolio-icon"><Images size={18}/></span>
                    <span className="my-work-card-text">
                      <span className="my-work-status-label">{portfolio.published?'PUBLISHED · PUBLIC':'CREATED · PRIVATE'}</span>
                      <strong>{portfolio.title}</strong>
                      <small>{portfolio.photos.length} photographs</small>
                    </span>
                    <ArrowRight size={16}/>
                  </button>)}
                </div>}
                {owned.length > 0 && <WorkReceipts wishId={wish.id}/>}
                {wish.kind==='photography' && <button type="button"
                  className="my-work-add-portfolio" onClick={()=>onNewPortfolio(wish.id)}>
                  <Images size={15}/> Build another portfolio under this wish <ArrowRight size={14}/>
                </button>}
                {owned.length===0 && <>
                  <p><strong>First planned deed:</strong> {readable(wish.mission_id)}</p>
                  <p><strong>Your choice:</strong> {readable(wish.answer)}</p>
                  <p>We have not executed this mission yet.</p>
                  <button type="button" className="my-work-delete" disabled={deleting===wish.id}
                    onClick={()=>void deleteWish(wish)}><Trash2 size={13}/> Delete wish</button>
                </>}
                {owned.length>0 && <p className="my-work-nested-note">
                  To delete this wish, delete its portfolios first. Your public links stay unchanged.
                </p>}
              </div>}
            </article>;
          })}</div>}
    </>}

    <div className="my-work-actions">
      <button type="button" className="primary" onClick={onNewWish}>
        {wishesRemaining(wishes.length) ? 'Make another wish' : 'Explore another idea'} <ArrowRight size={17}/>
      </button>
      <button type="button" className="back" onClick={() => setRefresh(x => x + 1)}>
        <RefreshCw size={14}/> Refresh saved work
      </button>
      <button type="button" className="back" onClick={onNewWish}><ArrowLeft size={14}/> Back to home</button>
    </div>
  </section>;
}
