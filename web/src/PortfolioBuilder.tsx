import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { getSupabase, getOrCreateUser } from './supabaseClient';
import { preparePhoto, type PortfolioPhoto, type PreparedPhoto, MAX_PHOTOS } from './photoProcessing';
import { pickInitialSelection } from './photoQuality';
import './portfolio.css';

const BUCKET = 'portfolio-previews';

type Portfolio = {
  id: string;
  title: string;
  introduction: string;
  status: 'PRIVATE';
  photos: PortfolioPhoto[];
};

type Props = {
  initialId: string | null;
  onBack: () => void;
  onCreated: (id: string) => void;
};

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : 'The portfolio could not be saved. Please try again.';
}

async function signedPhotoUrls(photos: PortfolioPhoto[]): Promise<Record<string, string>> {
  const storage = getSupabase().storage.from(BUCKET);
  const entries = await Promise.all(photos.map(async photo => {
    const { data, error } = await storage.createSignedUrl(photo.path, 3600);
    if (error || !data?.signedUrl) throw error || new Error('Cannot open a private photograph.');
    return [photo.id, data.signedUrl] as const;
  }));
  return Object.fromEntries(entries);
}

export default function PortfolioBuilder({ initialId, onBack, onCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('My photography');
  const [introduction, setIntroduction] = useState('A collection of moments worth keeping.');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [edited, setEdited] = useState(false);
  const [rendered, setRendered] = useState<string[]>([]);
  const selected = photos.filter(photo => photo.selected);

  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) throw new Error('This is a private draft. Please open it in the browser where you created it.');
        const { data, error: readError } = await getSupabase()
          .from('portfolios').select('id,title,introduction,photos,status')
          .eq('id', initialId).single();
        if (readError || !data) throw new Error('Private portfolio not found for this session.');
        const loaded = data as Portfolio;
        const links = await signedPhotoUrls(loaded.photos);
        if (cancelled) return;
        setPortfolio(loaded); setPhotos(loaded.photos); setUrls(links);
        setTitle(loaded.title); setIntroduction(loaded.introduction);
      } catch (cause) {
        if (!cancelled) setError(friendlyError(cause));
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [initialId]);

  const create = async () => {
    if (busy) return;
    if (files.length < 3 || files.length > MAX_PHOTOS) {
      setError(`Choose between 3 and ${MAX_PHOTOS} photographs.`);
      return;
    }
    setBusy(true); setError(''); setProgress('Preparing your photographs on this device...');
    const uploaded: string[] = [];
    let committed = false;
    try {
      const seen = new Set<string>();
      const prepared: PreparedPhoto[] = [];
      for (const [index, file] of files.entries()) {
        setProgress(`Checking photograph ${index + 1} of ${files.length}...`);
        const result = await preparePhoto(file);
        if (seen.has(result.meta.hash)) continue;
        seen.add(result.meta.hash);
        prepared.push(result);
      }
      if (prepared.length < 3) {
        throw new Error('At least three different photographs are needed. Duplicate files were skipped.');
      }
      const featured = new Set(pickInitialSelection(prepared.map(item => item.meta)));
      const user = await getOrCreateUser();
      const id = crypto.randomUUID();
      const storage = getSupabase().storage.from(BUCKET);
      const finalPhotos: PortfolioPhoto[] = [];

      for (const [index, photo] of prepared.entries()) {
        setProgress(`Saving private photograph ${index + 1} of ${prepared.length}...`);
        const path = `${user.id}/${id}/${photo.meta.id}.webp`;
        const { error: uploadError } = await storage.upload(path, photo.blob, {
          upsert: false, contentType: 'image/webp', cacheControl: '3600'
        });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        finalPhotos.push({ ...photo.meta, path, selected: featured.has(photo.meta.id) });
      }

      // Signed URLs require successful owner-scoped Storage SELECT, not public access.
      const links = await signedPhotoUrls(finalPhotos);
      setProgress('Creating and verifying your private portfolio...');
      const supabase = getSupabase();
      const { data, error: createError } = await supabase.from('portfolios')
        .insert({ id, user_id: user.id, title, introduction, photos: finalPhotos, status: 'PRIVATE' })
        .select('id,title,introduction,photos,status').single();
      if (createError || !data) throw createError || new Error('Could not verify the portfolio.');
      committed = true;
      const saved = data as Portfolio;
      setPortfolio(saved); setPhotos(saved.photos); setUrls(links);
      setEdited(false); setRendered([]);
      onCreated(saved.id);
    } catch (cause) {
      if (!committed && uploaded.length) {
        const { error: cleanupError } = await getSupabase().storage.from(BUCKET).remove(uploaded);
        if (cleanupError) console.warn('Private upload cleanup failed', cleanupError.message);
      }
      setError(friendlyError(cause));
    } finally { setBusy(false); setProgress(''); }
  };

  const togglePhoto = (id: string) => {
    setPhotos(current => current.map(photo => photo.id === id ? { ...photo, selected: !photo.selected } : photo));
    setEdited(true);
  };

  const saveChanges = async () => {
    if (!portfolio || busy) return;
    if (!title.trim()) { setError('Enter a portfolio title.'); return; }
    if (!selected.length) { setError('Select at least one photograph.'); return; }
    setBusy(true); setError('');
    try {
      const { data, error: updateError } = await getSupabase().from('portfolios')
        .update({ title: title.trim(), introduction: introduction.trim(), photos, updated_at: new Date().toISOString() })
        .eq('id', portfolio.id).select('id').single();
      if (updateError || !data) throw updateError || new Error('Changes could not be verified.');
      setEdited(false);
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const deletePortfolio = async () => {
    if (!portfolio || busy || !window.confirm('Delete this private portfolio and all its uploaded previews? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const storage = getSupabase().storage.from(BUCKET);
      const paths = photos.map(photo => photo.path);
      const { error: removeError } = await storage.remove(paths);
      if (removeError) throw removeError;
      const { error: deleteError } = await getSupabase().from('portfolios').delete().eq('id', portfolio.id);
      if (deleteError) throw deleteError;
      onBack();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  if (loading) return <section className="portfolio-workspace entrance"><p className="eyebrow">PRIVATE PORTFOLIO</p><h2>Opening your photographs...</h2></section>;

  return <section className="portfolio-workspace entrance">
    <button className="portfolio-back" type="button" onClick={onBack}><ArrowLeft size={16}/> Back to wishes</button>

    {!portfolio ? <>
      <div className="portfolio-intro">
        <div className="portfolio-spark"><ImagePlus size={23}/></div>
        <p className="eyebrow">YOUR FIRST REAL DEED</p>
        <h2>Let's build your <em>portfolio.</em></h2>
        <p>Choose 3–15 photographs. I'll remove exact duplicates, prepare optimized previews, and arrange an initial gallery you can edit.</p>
      </div>
      <label className="portfolio-drop">
        <UploadCloud size={27} strokeWidth={1.5}/>
        <strong>{files.length ? `${files.length} photographs selected` : 'Choose photographs'}</strong>
        <span>JPEG, PNG or WebP · 20 MB each, maximum 15</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy}
          onChange={event => { setFiles(Array.from(event.currentTarget.files || [])); setError(''); }}/>
      </label>
      {files.length > 0 && <p className="portfolio-filehint">
        {files.slice(0, 4).map(file => file.name).join(' · ')}{files.length > 4 ? ` · and ${files.length - 4} more` : ''}
      </p>}
      <div className="portfolio-form">
        <label htmlFor="portfolio-title">Portfolio title</label>
        <input id="portfolio-title" value={title} maxLength={100} onChange={event => setTitle(event.target.value)}/>
        <label htmlFor="portfolio-intro">A short introduction (optional)</label>
        <textarea id="portfolio-intro" rows={2} value={introduction} maxLength={600}
          onChange={event => setIntroduction(event.target.value)}/>
      </div>
      <div className="portfolio-privacy"><LockKeyhole size={17}/>
        <span>Private by default. Original files stay on your device. Only optimized, metadata-stripped preview copies are uploaded.</span>
      </div>
      <button type="button" className="primary" disabled={busy || files.length < 3 || files.length > MAX_PHOTOS || !title.trim()}
        onClick={() => void create()}>{busy ? progress : 'Build my private portfolio'} {!busy && <ArrowRight size={17}/>}</button>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="subtle">This is technical photo preparation, not AI artistic criticism. Nothing will be published or shared.</p>
    </> : <>
      <div className="portfolio-intro">
        <div className="portfolio-spark"><Sparkles size={23}/></div>
        <p className="eyebrow">CREATED · PRIVATE</p>
        <h2>Your first portfolio <em>exists.</em></h2>
        <p>Here is your real gallery. Select the photographs you want to show and refine your introduction.</p>
      </div>
      <div className="portfolio-form">
        <label htmlFor="portfolio-title-edit">Portfolio title</label>
        <input id="portfolio-title-edit" value={title} maxLength={100}
          onChange={event => { setTitle(event.target.value); setEdited(true); }}/>
        <label htmlFor="portfolio-intro-edit">Introduction</label>
        <textarea id="portfolio-intro-edit" rows={2} value={introduction} maxLength={600}
          onChange={event => { setIntroduction(event.target.value); setEdited(true); }}/>
      </div>
      <div className="portfolio-gallery-head">
        <strong>Your collection</strong>
        <span>{selected.length} of {photos.length} selected · technical first pass</span>
      </div>
      <div className="portfolio-grid">
        {photos.map(photo => <button key={photo.id} type="button"
          aria-pressed={photo.selected} className={`portfolio-tile ${photo.selected ? 'selected' : ''}`}
          onClick={() => togglePhoto(photo.id)}>
          <img src={urls[photo.id]} alt={photo.name} loading="lazy"
            onLoad={() => setRendered(current => current.includes(photo.id) ? current : [...current, photo.id])}/>
          <span className="portfolio-check">{photo.selected ? <Check size={14}/> : '+'}</span>
          <span className="portfolio-name">{photo.name}</span>
        </button>)}
      </div>
      <div className="portfolio-receipt">
        <div className="portfolio-receipt-head"><ShieldCheck size={19}/> <strong>Work completed</strong></div>
        <div><span>Optimized photos stored privately</span><strong>{photos.length}</strong></div>
        <div><span>Gallery entries rendered in browser</span><strong>{rendered.length} / {photos.length}</strong></div>
        <div><span>Exact duplicates</span><strong>Skipped</strong></div>
        <div><span>Publication</span><strong>Not published</strong></div>
        <p>This gallery was actually saved. Image ordering uses basic exposure, resolution and detail signals; it does not assess artistic merit.</p>
      </div>
      <button type="button" className="primary" disabled={!edited || busy || !selected.length || !title.trim()} onClick={() => void saveChanges()}>
        {busy ? 'Saving...' : edited ? 'Save gallery changes' : 'All changes saved'} <Check size={16}/>
      </button>
      <p className="subtle"><LockKeyhole size={13}/> This page is private to this browser session. Your images aren't published. The URL is a bookmark, not a share link.</p>
      <div className="portfolio-secondary-actions">
        <button type="button" onClick={() => void deletePortfolio()} disabled={busy}><Trash2 size={15}/> Delete portfolio</button>
        <button type="button" onClick={() => window.location.reload()} disabled={busy}><RefreshCw size={15}/> Reload saved draft</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </>}
  </section>;
}
