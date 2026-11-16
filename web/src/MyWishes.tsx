import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Plus, RotateCcw, Trash2 } from 'lucide-react';
import JinnAvatar from './JinnAvatar';
import { deleteFirstWish, listFirstWishes, type WishSummary } from './firstWishStore';
import {
  createJinn, deleteEmptyJinn, ensurePrimaryJinn, listJinns, moveWishToJinn,
  renameJinn, type JinnIdentity,
} from './jinnStore';
import './myWishes.css';
import { formatLocalDate, localizeError, useLocale, wishCountNoun } from './i18n';
import { lastChosenJinn, rememberChosenJinn } from './adaptiveHome';

type Props = {
  email: string;
  ownerId: string;
  onNewWish: (jinnId?: string) => void;
  onOpenFirstWish: (id: string, aspiration: string) => void;
};
type EditorMode = 'create' | 'rename' | null;

export default function MyWishes({ email, ownerId, onNewWish, onOpenFirstWish }: Props) {
  const {locale,t}=useLocale();
  const [jinns, setJinns] = useState<JinnIdentity[] | null>(null);
  const [wishes, setWishes] = useState<WishSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EditorMode>(null);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  // Home and My Jinns share one explicit per-account selection. The default
  // is only a visual fallback; never overwrite a stale stored choice silently.
  const selectJinn = (id: string) => {
    setSelectedId(id);
    rememberChosenJinn(ownerId, id);
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      await ensurePrimaryJinn();
      const [companions, saved] = await Promise.all([listJinns(), listFirstWishes()]);
      setJinns(companions);
      setWishes(saved);
      setSelectedId(previous => {
        if (companions.some(jinn => jinn.id === previous)) return previous;
        const remembered = lastChosenJinn(ownerId);
        return companions.find(jinn => jinn.id === remembered)?.id
          ?? companions.find(jinn => jinn.is_primary)?.id ?? companions[0]?.id ?? null;
      });
    } catch (cause) {
      setJinns(null);
      setWishes(null);
      setError(localizeError(cause,locale,'Could not open My Jinns.'));
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const selected = jinns?.find(jinn => jinn.id === selectedId) ?? null;
  const selectedWishes = wishes?.filter(wish => wish.jinn_id === selectedId) ?? [];
  const unavailable = wishes?.filter(wish => !jinns?.some(jinn => jinn.id === wish.jinn_id)) ?? [];
  const counts = (id: string) => wishes?.filter(wish => wish.jinn_id === id).length ?? 0;

  const startEditor = (mode: Exclude<EditorMode, null>) => {
    setError('');
    setEditor(mode);
    setName(mode === 'rename' ? selected?.name ?? '' : '');
    setPurpose(mode === 'rename' ? selected?.purpose ?? '' : '');
  };
  const saveEditor = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = editor === 'create' ? await createJinn(name, purpose)
        : editor === 'rename' && selected ? await renameJinn(selected, name, purpose) : null;
      if (!updated) throw new Error('Choose a Jinn to edit.');
      setEditor(null);
      await refresh();
      selectJinn(updated.id);
    } catch (cause) { setError(localizeError(cause,locale,'Could not save Jinn.')); }
    finally { setBusy(false); }
  };
  const removeJinn = async () => {
    if (!selected || selected.is_primary || counts(selected.id) !== 0) return;
    if (!window.confirm(t('Delete {name}? Only an empty Jinn can be deleted. Your other Wishes will stay.',{name:selected.name}))) return;
    setBusy(true); setError('');
    try { await deleteEmptyJinn(selected); await refresh(); }
    catch (cause) { setError(localizeError(cause,locale,'Could not delete Jinn.')); }
    finally { setBusy(false); }
  };
  const moveWish = async (wishId: string) => {
    const target = moveTarget[wishId];
    if (!target || !selected || !jinns?.some(jinn => jinn.id === target)) return;
    setBusy(true); setError('');
    try {
      await moveWishToJinn(wishId, target, selected.id);
      setMoveTarget(previous => ({ ...previous, [wishId]: '' }));
      await refresh();
      selectJinn(target);
    } catch (cause) { setError(localizeError(cause,locale,'Could not move Wish.')); }
    finally { setBusy(false); }
  };
  const removeWish = async (id: string) => {
    if (!window.confirm(t('Delete this wish, its Deeds and artifacts? This cannot be undone.'))) return;
    setDeleting(id); setError('');
    try {
      await deleteFirstWish(id);
      setWishes(items => items?.filter(item => item.id !== id) ?? null);
    } catch (cause) { setError(localizeError(cause,locale,'Could not delete Wish.')); }
    finally { setDeleting(null); }
  };

  return <section className="my-work entrance">
    <div className="my-work-heading">
      <JinnAvatar size="large"/>
      <p className="eyebrow">{t('YOUR COMPANIONS')}</p><h2>{t('My')} <em>{t('Jinns.')}</em></h2>
      <p className="my-work-subtitle">{t('Each Jinn helps with assigned Wishes. Your Wishes stay in your account and keep separate context.')}</p>
      <p className="my-work-email"><LockKeyhole size={13}/> {t('Signed in as {email}',{email})}</p>
    </div>

    {error && <div className="my-work-cap-warning" role="alert">{error} <button type="button" onClick={() => void refresh()}><RotateCcw size={14}/> {t('Retry')}</button></div>}
    {loading ? <p className="my-work-status" role="status">{t('Opening your Jinns and Wishes…')}</p> : jinns && wishes && <>
      <div className="my-work-section-header"><h3>{t('My Jinns')}</h3><button className="jinn-action" type="button" onClick={() => startEditor('create')} disabled={busy}><Plus size={16}/> {t('Create Jinn')}</button></div>
      <div className="jinn-collection" aria-label={t('Choose a Jinn')}>
        {jinns.map(jinn => <button key={jinn.id} type="button" className={`jinn-choice ${selectedId === jinn.id ? 'is-selected' : ''}`}
          aria-pressed={selectedId === jinn.id} disabled={busy} onClick={() => { selectJinn(jinn.id); setEditor(null); setMoveTarget({}); }}>
          <JinnAvatar size="small"/>
          <span className="jinn-choice-content"><strong>{jinn.name}</strong><small>{jinn.is_primary ? t('Default Jinn ·')+' ' : ''}{counts(jinn.id)} {wishCountNoun(counts(jinn.id),locale)}</small>
            {jinn.purpose && <small className="jinn-purpose">{jinn.purpose}</small>}</span>
        </button>)}
      </div>

      {editor && <form className="jinn-editor" onSubmit={event => void saveEditor(event)}>
        <h3>{t(editor === 'create' ? 'Create Jinn' : 'Rename your Jinn')}</h3>
        <label htmlFor="jinn-name">{t('Jinn name')}</label>
        <input id="jinn-name" maxLength={60} required value={name} onChange={event => setName(event.target.value)} placeholder={t('A name you recognize')}/>
        <label htmlFor="jinn-purpose">{t('Purpose note (optional)')}</label>
        <textarea id="jinn-purpose" maxLength={160} rows={2} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder={t("What you'd like to use this Jinn for")}/>
        <p className="jinn-explainer">{t('This note is descriptive only. It does not change how Jinn drafts or share memories between Wishes.')}</p>
        <div className="jinn-editor-actions"><button type="submit" className="primary" disabled={busy}>{t(busy ? 'Saving…' : editor === 'create' ? 'Create Jinn' : 'Save Jinn')}</button>
          <button type="button" className="jinn-action" onClick={() => setEditor(null)} disabled={busy}>{t('Cancel')}</button></div>
      </form>}

      {selected && <div className="jinn-workspace">
        <div className="jinn-workspace-header">
          <div className="jinn-workspace-identity"><JinnAvatar size="medium"/><div><p className="eyebrow">{t(selected.is_primary ? 'YOUR DEFAULT COMPANION' : 'YOUR COMPANION')}</p><h3>{selected.name}</h3><p>{selected.purpose || t('Ready to help with any Wish.')}</p></div></div>
          <div className="jinn-workspace-tools"><button type="button" className="jinn-action" disabled={busy} onClick={() => startEditor('rename')}>{t('Edit Jinn')}</button>
            {!selected.is_primary && counts(selected.id) === 0 && <button type="button" className="my-work-delete" disabled={busy} onClick={() => void removeJinn()}><Trash2 size={14}/> {t('Delete empty Jinn')}</button>}</div>
        </div>
        <div className="my-work-section-header"><h3>{t("{name}'s Wishes",{name:selected.name})}</h3><span>{selectedWishes.length}</span></div>
        {selectedWishes.length === 0 ? <div className="my-work-empty">{t('No Wishes with {name} yet. Start one here, or move a saved Wish from another Jinn.',{name:selected.name})}</div> :
          <div className="my-work-list">{selectedWishes.map(item => <article className="my-work-card" key={item.id}>
            <button type="button" className="my-work-card-main" onClick={() => onOpenFirstWish(item.id, item.aspiration)}>
              <span className="my-work-card-text"><span className="my-work-status-label">{t(item.state.toUpperCase())} · {t('PRIVATE WISH')}</span>
                <strong>{item.aspiration}</strong><small>{t('Updated {date}',{date:formatLocalDate(item.updated_at,locale)})}</small></span><ArrowRight size={18}/>
            </button>
            <div className="my-work-details">
              {jinns.length > 1 && <div className="jinn-move">
                <label htmlFor={`move-${item.id}`}>{t('Switch the Jinn helping with this Wish')}</label>
                <select id={`move-${item.id}`} disabled={busy} value={moveTarget[item.id] || ''}
                  onChange={event => setMoveTarget(previous => ({ ...previous, [item.id]: event.target.value }))}>
                  <option value="">{t('Keep with {name}',{name:selected.name})}</option>
                  {jinns.filter(jinn => jinn.id !== selected.id).map(jinn => <option value={jinn.id} key={jinn.id}>{jinn.name}</option>)}
                </select>
                {moveTarget[item.id] && <div className="jinn-move-confirm" role="group" aria-label={t('Confirm move Wish')}>
                  <p>{t('This Jinn will help with this Wish from now on. Your saved work stays with the Wish. Previous Deeds are not reassigned to a different author.')}</p>
                  <button type="button" className="jinn-action" disabled={busy} onClick={() => void moveWish(item.id)}>{t('Confirm move')}</button>
                  <button type="button" className="jinn-action" disabled={busy} onClick={() => setMoveTarget(previous => ({ ...previous, [item.id]: '' }))}>Cancel</button>
                </div>}
              </div>}
              <button type="button" className="my-work-delete" disabled={busy || deleting === item.id} onClick={() => void removeWish(item.id)}><Trash2 size={14}/>{t(deleting === item.id ? 'Deleting…' : 'Delete Wish')}</button>
            </div>
          </article>)}</div>}
        <div className="my-work-actions"><button className="primary" onClick={() => onNewWish(selected.id)}>{t('Start a Wish with {name}',{name:selected.name})} <ArrowRight size={16}/></button></div>
      </div>}

      {unavailable.length > 0 && <p role="alert" className="my-work-cap-warning">{t('{count} saved Wish(es) reference an unavailable Jinn. No association was changed. Contact support before moving these Wishes.',{count:unavailable.length})}</p>}
    </>}
  </section>;
}
