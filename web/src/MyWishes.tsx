import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Images, LockKeyhole, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { duplicateWishGroups } from './wishDedup';
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
  title: string;
  photos: Array<{ id: string }>;
  status: 'PRIVATE';
  created_at: string;
};
type Props = {
  email: string;
  onOpenPortfolio: (id: string) => void;
  onNewWish: () => void;
};

function readable(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
}

export default function MyWishes({ email, onOpenPortfolio, onNewWish }: Props) {
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
          db.from('portfolios').select('id,title,photos,status,created_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
        ]);
        if (wishResult.error) throw wishResult.error;
        if (portfolioResult.error) throw portfolioResult.error;
        if (active) {
          setWishes((wishResult.data || []) as SavedWish[]);
          setPortfolios((portfolioResult.data || []) as SavedPortfolio[]);
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
    if (deleting || !window.confirm('Delete this saved wish? This does not delete any portfolio.')) return;
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
        : <div className="my-work-list">{wishes.map(wish => <article className="my-work-card" key={wish.id}>
            <button type="button" className="my-work-card-main" aria-expanded={expanded === wish.id}
              onClick={() => setExpanded(current => current === wish.id ? null : wish.id)}>
              <div className="my-work-card-text">
                <span className="my-work-status-label">MISSION PLANNED · NOT EXECUTED</span>
                <strong>{wish.aspiration}</strong>
                <small>{readable(wish.mission_id)}</small>
              </div>
              <ArrowRight size={17} className={expanded === wish.id ? 'turned' : ''}/>
            </button>
            {expanded === wish.id && <div className="my-work-details">
              <p><strong>Selected mission:</strong> {readable(wish.mission_id)}</p>
              <p><strong>Your choice:</strong> {readable(wish.answer)}</p>
              <p>This mission is saved. No external work has been executed for it yet.</p>
              <button type="button" className="my-work-delete" disabled={deleting === wish.id}
                onClick={() => void deleteWish(wish)}><Trash2 size={13}/> Delete wish</button>
            </div>}
          </article>)}</div>}

      <div className="my-work-section-header">
        <h3>My portfolios</h3>
        <span>{portfolios.length}</span>
      </div>
      {portfolios.length === 0
        ? <p className="my-work-empty">No portfolios yet. A private gallery will appear here after you create it.</p>
        : <div className="my-work-list">{portfolios.map(portfolio => <button type="button"
          className="my-work-card my-work-portfolio" key={portfolio.id}
          onClick={() => onOpenPortfolio(portfolio.id)}>
          <span className="my-work-portfolio-icon"><Images size={20}/></span>
          <span className="my-work-card-text">
            <span className="my-work-status-label">CREATED · PRIVATE</span>
            <strong>{portfolio.title}</strong>
            <small>{portfolio.photos.length} photographs</small>
          </span>
          <ArrowRight size={17}/>
        </button>)}</div>}
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
