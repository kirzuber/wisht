import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Images, LockKeyhole, RefreshCw, Trash2 } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { duplicateWishGroups } from './wishDedup';
import { artifactsForWish } from './wishArtifacts';
import WorkReceipts from './WorkReceipts';
import PhotoWatch from './PhotoWatch';
import JinnAvatar from './JinnAvatar';
import type { SubmissionRow } from './submissionModel';
import type { SavedShortlist } from './opportunityTypes';
import type { CareerSaved } from './careerTypes';
import type { SoccerSaved } from './soccerTypes';
import { MAX_SAVED_WISHES, wishesRemaining } from './wishLimit';
import { dataErrorMessage, loadOptionalSavedRows, loadSavedWishRows, type SavedWish } from './savedWishRows';
import './myWishes.css';

type SavedPortfolio = {
  id: string;
  wish_id: string;
  published: boolean | null;
  title: string;
  photos: Array<{ id: string }>;
  status: 'PRIVATE';
  created_at: string;
};
type PortfolioRow = Omit<SavedPortfolio, 'published'>;
type Props = {
  email: string;
  onOpenPortfolio: (id: string) => void;
  onNewPortfolio: (wishId: string) => void;
  onOpenScout: (wishId: string) => void;
  onCareerScout: (wishId: string) => void;
  onSoccerScout: (wishId: string) => void;
  onPrepareSubmission: (wishId:string, shortlistId:string, opportunityId:string) => void;
  onOpenSubmission: (wishId:string, packageId:string) => void;
  onNewWish: () => void;
  onOpenFirstWish: (id:string, aspiration:string) => void;
};

function readable(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
}
export default function MyWishes({ email, onOpenPortfolio, onNewPortfolio, onOpenScout, onCareerScout, onSoccerScout, onPrepareSubmission, onOpenSubmission, onNewWish, onOpenFirstWish }: Props) {
  const [wishes, setWishes] = useState<SavedWish[]>([]);
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [shortlists,setShortlists]=useState<SavedShortlist[]>([]);
  const [careerLists,setCareerLists]=useState<CareerSaved[]>([]);
  const [soccerLists,setSoccerLists]=useState<SoccerSaved[]>([]);
  const [submissionDrafts,setSubmissionDrafts]=useState<SubmissionRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [relatedWorkComplete, setRelatedWorkComplete] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const duplicateGroups = duplicateWishGroups(wishes);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(''); setLoadFailed(false); setLoadWarnings([]);
      try {
        const user = await getAuthenticatedUser();
        const db = getSupabase();
        const { wishes: savedWishes, warning: artifactWarning, artifactStatus } = await loadSavedWishRows(
          () => db.from('wishes').select('id,aspiration,kind,mission_id,answer,status,created_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
          ids => db.from('wishes').select('id,first_artifact').eq('user_id', user.id).in('id', ids)
        );
        const warnings: string[] = artifactWarning ? [artifactWarning] : [];
        let complete = artifactStatus !== 'unavailable';
        const optionalRows = async <T,>(label: string, query: PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>, affectsLinkedWork = true): Promise<T[]> => {
          const result = await loadOptionalSavedRows(label, query);
          if (result.warning) {
            if (affectsLinkedWork) complete = false;
            warnings.push(result.warning);
          }
          return result.rows;
        };
        const [portfolioRows, shortlistRows, submissionRows, careerRows, soccerRows] = await Promise.all([
          optionalRows<PortfolioRow>('Portfolios', db.from('portfolios').select('id,wish_id,title,photos,status,created_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)),
          optionalRows<SavedShortlist>('Opportunity shortlists', db.from('opportunity_shortlists')
            .select('id,wish_id,genre,free_only,source,feed_url,fetched_at,matches,created_at')
            .eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)),
          optionalRows<SubmissionRow>('Submission drafts', db.from('submission_packages')
            .select('id,wish_id,shortlist_id,portfolio_id,opportunity_id,opportunity_title,deadline,listing_url,organizer_url,rules_notes,reviewed_by_user,artist_name,artist_statement,cover_note,selected_photos,created_at,updated_at')
            .eq('user_id',user.id).order('updated_at',{ascending:false}).limit(50)),
          optionalRows<CareerSaved>('Career shortlists', db.from('career_shortlists')
            .select('id,wish_id,query,country,fetched_at,ai_used,matches,created_at')
            .eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)),
          optionalRows<SoccerSaved>('Soccer shortlists', db.from('soccer_shortlists')
            .select('id,wish_id,city,level,age_group,fetched_at,matches,created_at')
            .eq('user_id',user.id).order('created_at',{ascending:false}).limit(20))
        ]);
        const galleryIds = portfolioRows.map(p => p.id);
        const publicationRows = galleryIds.length
          ? await optionalRows<{ portfolio_id: string }>('Publication status', db.from('portfolio_publications').select('portfolio_id').in('portfolio_id', galleryIds), false)
          : [];
        const publicationStatusKnown = !warnings.some(warning => warning.startsWith('Publication status'));
        const liveIds = new Set(publicationRows.map(p => p.portfolio_id));
        if (active) {
          setWishes(savedWishes);
          setShortlists(shortlistRows);
          setCareerLists(careerRows);
          setSoccerLists(soccerRows);
          setSubmissionDrafts(submissionRows);
          setPortfolios(portfolioRows.map(p => ({ ...p, published: publicationStatusKnown ? liveIds.has(p.id) : null })));
          setLoadWarnings(warnings);
          setRelatedWorkComplete(complete);
          const photoWish = savedWishes.find(wish => wish.kind === 'photography');
          setExpanded(previous=>previous??photoWish?.id??null);
        }
      } catch (cause) {
        if (active) {
          setLoadFailed(true);
          setError(dataErrorMessage(cause, 'Could not load your saved wishes.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [refresh]);

  const deleteSoccerList=async(record:SoccerSaved)=>{
    if(!window.confirm('Remove this soccer shortlist? Its historical Work Receipt will remain.'))return;
    setError('');
    try{
      await getAuthenticatedUser();
      const {error:e}=await getSupabase().from('soccer_shortlists').delete().eq('id',record.id);
      if(e)throw e;
      setSoccerLists(current=>current.filter(x=>x.id!==record.id));
    }catch(e){setError(e instanceof Error?e.message:'Could not remove soccer shortlist.');}
  };
  const deleteCareerList=async(record:CareerSaved)=>{
    if(!window.confirm('Remove this saved career shortlist? The Work Receipt will remain.'))return;
    setError('');
    try{
      await getAuthenticatedUser();
      const {error:e}=await getSupabase().from('career_shortlists').delete().eq('id',record.id);
      if(e)throw e;
      setCareerLists(current=>current.filter(x=>x.id!==record.id));
    }catch(e){setError(e instanceof Error?e.message:'Could not remove this shortlist.');}
  };
  const deleteShortlist=async(record:SavedShortlist)=>{
    if(submissionDrafts.some(d=>d.shortlist_id===record.id)){
      setError('Delete the submission drafts made from this shortlist before removing it.');
      return;
    }
    if(!window.confirm('Remove this saved opportunity shortlist? Its historical Work Receipt will remain.'))return;
    setError('');
    try{
      await getAuthenticatedUser();
      const {error:removeError}=await getSupabase().from('opportunity_shortlists').delete().eq('id',record.id);
      if(removeError)throw removeError;
      setShortlists(current=>current.filter(item=>item.id!==record.id));
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not remove this shortlist.');}
  };
  const deleteWish = async (wish: SavedWish) => {
    if (!relatedWorkComplete) {
      setError('Some linked work could not load. Refresh after the error is resolved before deleting this wish.');
      return;
    }
    if (artifactsForWish(wish,portfolios).length || shortlists.some(s=>s.wish_id===wish.id) || submissionDrafts.some(d=>d.wish_id===wish.id) || careerLists.some(c=>c.wish_id===wish.id) || soccerLists.some(c=>c.wish_id===wish.id)) {
      setError('Remove linked portfolios, saved shortlists and submission drafts before deleting this wish.');
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
      setError(cause instanceof Error && /foreign key|23503/.test(cause.message)
        ? 'Remove your existing photography watches and linked work before deleting this wish.'
        : cause instanceof Error ? cause.message : 'Could not delete this wish.');
    } finally { setDeleting(null); }
  };

  return <section className="my-work entrance">
    <div className="my-work-heading">
      <JinnAvatar size="medium"/>
      <p className="eyebrow">YOUR WISH SPACE</p>
      <h2>Welcome back.<br/><em>Where shall we pick up?</em></h2>
      <p className="my-work-subtitle">Your wishes, drafts, and next steps are here whenever you return.</p>
      <p className="my-work-email"><LockKeyhole size={13}/> Signed in as {email}</p>
    </div>

    {error && <p className="error" role="alert">{error}</p>}
    {loadWarnings.length > 0 && <div className="my-work-cap-warning" role="status">
      <strong>Some saved details are unavailable.</strong>
      <ul>{loadWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    </div>}
    {loading ? <p className="my-work-status">Opening your saved work…</p> : loadFailed
      ? <p className="my-work-status">Your saved wishes could not be loaded. Refresh saved work to try again.</p> : <>
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
            const savedScouts=shortlists.filter(item=>item.wish_id===wish.id);
            const packs=submissionDrafts.filter(item=>item.wish_id===wish.id);
            const savedCareers=careerLists.filter(item=>item.wish_id===wish.id);
            const savedSoccer=soccerLists.filter(item=>item.wish_id===wish.id);
            const hasDeeds=owned.length>0||savedScouts.length>0||packs.length>0||savedCareers.length>0||savedSoccer.length>0;
            const opened=expanded===wish.id;
            return <article className="my-work-card" key={wish.id}>
              <button type="button" className="my-work-card-main" aria-expanded={opened}
                onClick={()=>setExpanded(current=>current===wish.id?null:wish.id)}>
                <span className="my-work-card-text">
                  <span className="my-work-status-label">{wish.first_artifact?'FIRST DEED PREPARED · WISH SAVED':!relatedWorkComplete?'SAVED WORK STATUS UNAVAILABLE':hasDeeds
                    ? 'WORK SAVED · OPEN FOR DETAILS'
                    : 'WISH PLANNED · NO COMPLETED DEEDS'}</span>
                  <strong>{wish.aspiration}</strong>
                  <small>{wish.first_artifact?'Editable artifact · Jinn continuity':hasDeeds
                    ? owned.length+' portfolio(s) · '+(savedScouts.length+savedCareers.length+savedSoccer.length)+' shortlist(s) · '+packs.length+' submission draft(s)'
                    : readable(wish.mission_id)}</small>
                </span>
                <ArrowRight size={17} className={opened?'turned':''}/>
              </button>
              {opened && <div className="my-work-details">
                {!!wish.first_artifact&&<button type="button" className="my-work-add-portfolio" onClick={()=>onOpenFirstWish(wish.id,wish.aspiration)}>
                  Open artifact and continue with Jinn <ArrowRight size={14}/>
                </button>}
                {owned.length>0 && <div className="my-work-nested">
                  <p className="my-work-nested-label">YOUR PORTFOLIOS</p>
                  {owned.map(portfolio=><button type="button"
                    className="my-work-portfolio nested" key={portfolio.id}
                    onClick={()=>onOpenPortfolio(portfolio.id)}>
                    <span className="my-work-portfolio-icon"><Images size={18}/></span>
                    <span className="my-work-card-text">
                      <span className="my-work-status-label">{portfolio.published === null?'PUBLICATION STATUS UNAVAILABLE':portfolio.published?'PUBLISHED · PUBLIC':'CREATED · PRIVATE'}</span>
                      <strong>{portfolio.title}</strong>
                      <small>{portfolio.photos.length} photographs</small>
                    </span>
                    <ArrowRight size={16}/>
                  </button>)}
                </div>}
                {hasDeeds && <WorkReceipts wishId={wish.id} refreshKey={refresh}/>}
                {wish.kind==='photography' && <PhotoWatch wishId={wish.id}
                  onChange={()=>setRefresh(current=>current+1)}/>}
                {savedScouts.length>0 && <div className="my-work-nested">
                  <p className="my-work-nested-label">SAVED OPPORTUNITY SHORTLISTS</p>
                  {savedScouts.map(list=><div key={list.id} className="my-work-scout-card">
                    <strong>{list.matches.length} potential opportunities · {list.genre==='any'?'All photography':list.genre}</strong>
                    <small>Checked {new Date(list.fetched_at).toLocaleDateString()} · Indexed listings, not verified organizer terms</small>
                    <div className="my-work-scout-links">
                      {list.matches.map(m=><div key={m.id} className="my-work-opportunity-row">
                        <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {m.title} · {m.deadline}
                        </a>
                        <button type="button" className="my-work-prep-action"
                          onClick={()=>onPrepareSubmission(wish.id,list.id,m.id)}>
                          Prepare submission <ArrowRight size={12}/>
                        </button>
                      </div>)}
                    </div>
                    <button type="button" className="my-work-delete" onClick={()=>void deleteShortlist(list)}>
                      <Trash2 size={13}/> Remove shortlist
                    </button>
                  </div>)}
                </div>}
                {packs.length>0 && <div className="my-work-nested">
                  <p className="my-work-nested-label">YOUR SUBMISSION DRAFTS</p>
                  {packs.map(draft=><button type="button" className="my-work-portfolio nested" key={draft.id}
                    onClick={()=>onOpenSubmission(wish.id,draft.id)}>
                    <span className="my-work-portfolio-icon"><Images size={18}/></span>
                    <span className="my-work-card-text">
                      <span className="my-work-status-label">{draft.reviewed_by_user?'RULES REVIEWED BY YOU':'RULES REVIEW NEEDED'} · NOT SUBMITTED</span>
                      <strong>{draft.opportunity_title}</strong>
                      <small>{draft.selected_photos.length} previews · Saved {new Date(draft.updated_at).toLocaleDateString()}</small>
                    </span>
                    <ArrowRight size={15}/>
                  </button>)}
                </div>}
                {savedCareers.length>0 && <div className="my-work-nested">
                  <p className="my-work-nested-label">SAVED CAREER RESEARCH</p>
                  {savedCareers.map(list=><div className="my-work-scout-card" key={list.id}>
                    <strong>{list.matches.length} remote roles · {list.query}</strong>
                    <small>{list.country} · {new Date(list.fetched_at).toLocaleDateString()} ·
                      {list.ai_used?' Opt-in AI assessment':' Source listings only'} · Source: Himalayas</small>
                    <div className="my-work-scout-links">{list.matches.map(job=><div key={job.id} className="my-work-opportunity-row">
                      <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">{job.title} · {job.company}</a>
                      <small>{job.fit==='not_assessed'?'Match not assessed':'AI fit: '+job.fit} · Employer availability not independently confirmed</small>
                      <a href={job.applicationLink} target="_blank" rel="noopener noreferrer">Apply via source link</a>
                    </div>)}</div>
                    <button type="button" className="my-work-delete" onClick={()=>void deleteCareerList(list)}>
                      <Trash2 size={13}/> Remove shortlist
                    </button>
                  </div>)}
                </div>}
                {savedSoccer.length>0 && <div className="my-work-nested">
                   <p className="my-work-nested-label">SAVED SOCCER RESEARCH</p>
                   {savedSoccer.map(list=><div className="my-work-scout-card" key={list.id}>
                     <strong>{list.matches.length} club / program entries · {list.city}</strong>
                     <small>{list.level} · {list.age_group} · Source checked 14 Nov 2026 · No live registration confirmed</small>
                     <div className="my-work-scout-links">{list.matches.map(club=><div className="my-work-opportunity-row" key={club.id}>
                       <a href={club.sourceUrl} target="_blank" rel="noopener noreferrer">{club.name} — official website</a>
                       <a href={club.programUrl} target="_blank" rel="noopener noreferrer">Program information</a>
                       <small>Confirm availability, eligibility and dates directly with the club.</small>
                     </div>)}</div>
                     <button type="button" className="my-work-delete" onClick={()=>void deleteSoccerList(list)}>
                       <Trash2 size={13}/> Remove shortlist
                     </button>
                   </div>)}
                 </div>}
                 {wish.kind==='soccer' && <button type="button" className="my-work-add-portfolio"
                   onClick={()=>onSoccerScout(wish.id)}>
                   <ArrowRight size={15}/> Find soccer clubs
                 </button>}
                 {wish.kind==='career' && <button type="button" className="my-work-add-portfolio"
                  onClick={()=>onCareerScout(wish.id)}>
                   <ArrowRight size={15}/> Find remote career opportunities
                </button>}
                {wish.kind==='photography' && <button type="button" className="my-work-add-portfolio"
                  onClick={()=>onOpenScout(wish.id)}>
                  <ArrowRight size={15}/> Find photography opportunities
                </button>}
                {wish.kind==='photography' && <button type="button"
                  className="my-work-add-portfolio" onClick={()=>onNewPortfolio(wish.id)}>
                  <Images size={15}/> Build another portfolio under this wish <ArrowRight size={14}/>
                </button>}
                {!hasDeeds && !wish.first_artifact && relatedWorkComplete && <>
                  <p><strong>First planned deed:</strong> {readable(wish.mission_id)}</p>
                  <p><strong>Your choice:</strong> {readable(wish.answer)}</p>
                  <p>We have not executed this mission yet.</p>
                  <button type="button" className="my-work-delete" disabled={deleting===wish.id}
                    onClick={()=>void deleteWish(wish)}><Trash2 size={13}/> Delete wish</button>
                </>}
                {hasDeeds && <p className="my-work-nested-note">
                  To delete this wish, remove its portfolios, saved shortlists and submission drafts first. Public gallery links stay unchanged until you unpublish.
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
