import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, Download, ExternalLink, FileText, Images, LockKeyhole, RefreshCw, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import type { PortfolioPhoto } from './photoProcessing';
import type { Opportunity, SavedShortlist } from './opportunityTypes';
import { proposedCoverNote, selectedPhotoManifest, packageMarkdown, safeFilePart, type SubmissionRow } from './submissionModel';
import { buildZip, type ZipEntry } from './submissionZip';
import WorkReceipts from './WorkReceipts';
import './submissionPrep.css';

type Gallery={
 id:string;wish_id:string;title:string;introduction:string;
 photos:PortfolioPhoto[];
};
type IndexedEvidence={
 listingUrl:string;officialUrl:string|null;observedAt:string;
 sourceStatus:'INDEXED_PAGE_REACHED';organizerStatus:'NOT_CHECKED';notice:string
};
type Props={
 wishId:string;shortlistId?:string;opportunityId?:string;existingId?:string;
 onBack:()=>void;onBuildPortfolio:(wishId:string)=>void;onSaved:()=>void
};
const API=import.meta.env.VITE_API_BASE_URL||'';
function displayError(e:unknown){return e instanceof Error?e.message:'The submission draft could not be prepared.';}
function absoluteOfficialUrl(value:string){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
     !u.hostname.includes(':')&&!/^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname)&&
     !u.hostname.endsWith('.local')&&u.hostname!=='localhost';
 }catch{return false;}
}
export default function SubmissionPrep({
 wishId,shortlistId,opportunityId,existingId,onBack,onBuildPortfolio,onSaved
}:Props){
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [shortlist,setShortlist]=useState<SavedShortlist|null>(null);
 const [opportunity,setOpportunity]=useState<Opportunity|null>(null);
 const [galleries,setGalleries]=useState<Gallery[]>([]);
 const [portfolioId,setPortfolioId]=useState('');
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [imageUrls,setImageUrls]=useState<Record<string,string>>({});
 const [artistName,setArtistName]=useState('');
 const [artistStatement,setArtistStatement]=useState('');
 const [coverNote,setCoverNote]=useState('');
 const [organizerUrl,setOrganizerUrl]=useState('');
 const [rulesNotes,setRulesNotes]=useState('');
 const [reviewed,setReviewed]=useState(false);
 const [indexEvidence,setIndexEvidence]=useState<IndexedEvidence|null>(null);
 const [checking,setChecking]=useState(false);
 const [savedId,setSavedId]=useState<string|null>(null);
 const [dirty,setDirty]=useState(true);
 const [receiptVersion,setReceiptVersion]=useState(0);

 const gallery=useMemo(()=>galleries.find(p=>p.id===portfolioId)||null,[galleries,portfolioId]);
 const picked=useMemo(()=>gallery?.photos.filter(p=>p.selected&&selectedIds.includes(p.id))||[],[gallery,selectedIds]);
 const readyForReview=reviewed&&absoluteOfficialUrl(organizerUrl)&&rulesNotes.trim().length>=10;
 const hasChanged=(fn:()=>void)=>{fn();setDirty(true);setNotice('');};

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setError('');setLoading(true);
   try{
    const user=await getAuthenticatedUser();
    const db=getSupabase();
    let existing:SubmissionRow|null=null;
    let sourceId=shortlistId||'';
    let rootWishId=wishId;
    if(existingId){
      const {data,error:e}=await db.from('submission_packages')
        .select('id,wish_id,shortlist_id,portfolio_id,opportunity_id,opportunity_title,deadline,listing_url,organizer_url,rules_notes,reviewed_by_user,artist_name,artist_statement,cover_note,selected_photos,created_at,updated_at')
        .eq('id',existingId).eq('user_id',user.id).single();
      if(e||!data)throw new Error('Saved submission draft not found for your account.');
      existing=data as SubmissionRow;
      sourceId=existing.shortlist_id;
      rootWishId=existing.wish_id;
      if(rootWishId!==wishId)throw new Error('Submission draft belongs to a different wish.');
    }
    if(!sourceId)throw new Error('Choose a saved opportunity shortlist before preparing a submission.');
    const {data:source,error:sourceError}=await db.from('opportunity_shortlists')
      .select('id,wish_id,user_id,genre,free_only,source,feed_url,fetched_at,matches,created_at')
      .eq('id',sourceId).eq('user_id',user.id).eq('wish_id',rootWishId).single();
    if(sourceError||!source)throw new Error('The saved opportunity shortlist could not be opened.');
    const savedSource=source as SavedShortlist;
    const found=savedSource.matches.find(m=>m.id===(existing?.opportunity_id||opportunityId));
    if(!found)throw new Error('The selected opportunity is not in this shortlist.');
    const {data:galleryData,error:galleryError}=await db.from('portfolios')
      .select('id,wish_id,title,introduction,photos').eq('wish_id',rootWishId)
      .eq('user_id',user.id).order('created_at',{ascending:false}).limit(25);
    if(galleryError)throw galleryError;
    if(!active)return;
    const options=(galleryData||[]) as Gallery[];
    const initial=options.find(p=>p.id===existing?.portfolio_id)||options[0];
    setShortlist(savedSource);setOpportunity(found);setGalleries(options);
    setPortfolioId(initial?.id||'');
    setSelectedIds(existing?existing.selected_photos.map(p=>p.id):
      initial?.photos.filter(p=>p.selected).map(p=>p.id)||[]);
    setArtistName(existing?.artist_name||'');
    setArtistStatement(existing?.artist_statement||initial?.introduction||'');
    setCoverNote(existing?.cover_note||proposedCoverNote({
      opportunityTitle:found.title,portfolioTitle:initial?.title||'My photography',
      introduction:initial?.introduction||'',artistName:''
    }));
    setOrganizerUrl(existing?.organizer_url||'');
    setRulesNotes(existing?.rules_notes||'');
    setReviewed(existing?.reviewed_by_user||false);
    setSavedId(existing?.id||null);
    setDirty(!existing);
   }catch(e){if(active)setError(displayError(e));}
   finally{if(active)setLoading(false);}
  };
  void load();
  return()=>{active=false;};
 },[wishId,shortlistId,opportunityId,existingId]);

 useEffect(()=>{
  if(!gallery){setImageUrls({});return;}
  let active=true;
  const read=async()=>{
   try{
    const signed=await Promise.all(gallery.photos.filter(p=>p.selected).map(async photo=>{
      const {data,error:e}=await getSupabase().storage.from('portfolio-previews')
       .createSignedUrl(photo.path,1800);
      if(e||!data?.signedUrl)throw e||new Error('Photo could not be opened.');
      return [photo.id,data.signedUrl] as const;
    }));
    if(active)setImageUrls(Object.fromEntries(signed));
   }catch(e){if(active)setError(displayError(e));}
  };
  void read();
  return()=>{active=false;};
 },[gallery]);

 const changeGallery=(id:string)=>{
  if(existingId){setError('This saved draft is tied to one portfolio. Start from the shortlist to use another.');return;}
  const found=galleries.find(p=>p.id===id);
  hasChanged(()=>{
   setPortfolioId(id);
   setSelectedIds(found?.photos.filter(p=>p.selected).map(p=>p.id)||[]);
   setArtistStatement(found?.introduction||'');
   if(opportunity)setCoverNote(proposedCoverNote({
    opportunityTitle:opportunity.title,portfolioTitle:found?.title||'My photography',
    introduction:found?.introduction||'',artistName
   }));
  });
 };
 const inspect=async()=>{
  if(!opportunity||checking)return;
  setChecking(true);setError('');
  try{
   const res=await fetch(API+'/api/opportunity-detail?'+new URLSearchParams({listing:opportunity.sourceUrl}));
   const result=await res.json() as IndexedEvidence&{error?:string};
   if(!res.ok)throw new Error(result.error||'Could not inspect the index.');
   setIndexEvidence(result);
   if(result.officialUrl&&!organizerUrl)hasChanged(()=>{setOrganizerUrl(result.officialUrl!);setReviewed(false);});
  }catch(e){setError(displayError(e));}
  finally{setChecking(false);}
 };
 const save=async()=>{
  if(!gallery||!opportunity||!shortlist||busy)return;
  if(picked.length<1||picked.length>8){setError('Select between 1 and 8 photographs from this portfolio.');return;}
  if(reviewed&&!readyForReview){setError('To confirm rules review, provide an official HTTPS page and at least a short note about the requirements.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const user=await getAuthenticatedUser();
   const db=getSupabase();
   const editable={
    organizer_url:organizerUrl.trim(),rules_notes:rulesNotes.trim(),
    reviewed_by_user:reviewed,artist_name:artistName.trim(),
    artist_statement:artistStatement.trim(),cover_note:coverNote.trim(),
    selected_photos:selectedPhotoManifest(picked)
   };
   const query=existingId||savedId
     ? db.from('submission_packages').update(editable)
       .eq('id',existingId||savedId).eq('user_id',user.id)
     : db.from('submission_packages').insert({
        ...editable,user_id:user.id,wish_id:wishId,
        shortlist_id:shortlist.id,portfolio_id:gallery.id,
        opportunity_id:opportunity.id,opportunity_title:opportunity.title,
        deadline:opportunity.deadline,listing_url:opportunity.sourceUrl
       });
   const {data,error:saveError}=await query.select('id').single();
   if(saveError){
    if(saveError.code==='23505')throw new Error('A package for this opportunity and portfolio already exists. Open it from My wishes.');
    throw saveError;
   }
   if(!data)throw new Error('Could not verify the saved submission draft.');
   setSavedId(data.id as string);setDirty(false);setReceiptVersion(x=>x+1);
   setNotice('Private submission draft saved. Nothing was sent to the organizer.');
  }catch(e){setError(displayError(e));}
  finally{setBusy(false);}
 };
 const download=async()=>{
  if(!gallery||!opportunity||!savedId||dirty||busy)return;
  if(!picked.length){setError('No selected photographs in this package.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   await getAuthenticatedUser();
   const db=getSupabase();
   // Recheck current owner-scoped files before exporting; saved names alone are not proof.
   const {data,error:readError}=await db.from('portfolios')
    .select('photos').eq('id',gallery.id).eq('wish_id',wishId).single();
   if(readError||!data)throw new Error('The private source portfolio is no longer available.');
   const current=data.photos as PortfolioPhoto[];
   for(const photo of picked){
     if(!current.some(p=>p.id===photo.id&&p.path===photo.path&&p.selected)){
      throw new Error('The portfolio selection changed since saving. Reopen the draft and review the images.');
     }
   }
   const entries:ZipEntry[]=[];
   const intro=packageMarkdown({
     opportunityTitle:opportunity.title,deadline:opportunity.deadline,
     listingUrl:opportunity.sourceUrl,organizerUrl:organizerUrl.trim(),rulesNotes:rulesNotes.trim(),
     reviewedByUser:readyForReview,artistName:artistName.trim(),artistStatement:artistStatement.trim(),
     coverNote:coverNote.trim(),photoNames:picked.map(p=>p.name),portfolioTitle:gallery.title
   });
   entries.push({name:'READ_ME_FIRST.md',bytes:new TextEncoder().encode(intro)});
   for(const [index,photo] of picked.entries()){
    const {data:file,error:downloadError}=await db.storage.from('portfolio-previews').download(photo.path);
    if(downloadError||!file)throw downloadError||new Error('Could not access a private preview.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    entries.push({name:'photo-'+String(index+1).padStart(2,'0')+'-'+safeFilePart(photo.name)+'.webp',bytes});
   }
   const zip=buildZip(entries);
   const url=URL.createObjectURL(zip);
   const link=document.createElement('a');
   link.href=url;link.download='wisht-submission-'+safeFilePart(opportunity.title)+'.zip';
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),15_000);
   setNotice('ZIP prepared from your current private previews. Check original-file requirements before submitting.');
  }catch(e){setError(displayError(e));}
  finally{setBusy(false);}
 };
 const remove=async()=>{
  if(!savedId||busy||!window.confirm('Delete this saved submission draft? Other wish work will remain.'))return;
  setBusy(true);setError('');
  try{
    const user=await getAuthenticatedUser();
    const {error:e}=await getSupabase().from('submission_packages')
      .delete().eq('id',savedId).eq('user_id',user.id);
    if(e)throw e;
    onSaved();
  }catch(e){setError(displayError(e));setBusy(false);}
 };

 return <section className="submission-work entrance">
  <button className="back" type="button" onClick={onBack}><ArrowLeft size={16}/> Back to my wish</button>
  <div className="submission-heading">
    <div className="portfolio-spark"><FileText size={22}/></div>
    <p className="eyebrow">YOUR WISH · SUBMISSION PREPARATION</p>
    <h2>Prepare a real <em>next step.</em></h2>
    <p>Let's put your photographs and submission notes together. You keep control of what goes out.</p>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  {loading?<p className="submission-muted">Opening your saved work…</p>:
   opportunity?<div className="submission-stack">
    <section className="submission-card">
      <p className="submission-step"><span>01</span> The opportunity</p>
      <h3>{opportunity.title}</h3>
      <p className="submission-muted">Listed deadline: {opportunity.deadline} · <a href={opportunity.sourceUrl} target="_blank" rel="noopener noreferrer">Open source listing <ExternalLink size={12}/></a></p>
      <button className="submission-outline" type="button" onClick={()=>void inspect()} disabled={checking}>
       <RefreshCw size={15}/>{checking?'Checking index…':'Inspect listing for organizer link'}
      </button>
      {indexEvidence&&<p className="submission-index-note"><Check size={15}/>
        Index reached {new Date(indexEvidence.observedAt).toLocaleString()}. {indexEvidence.officialUrl?'An organizer link was found.':'No organizer link could be extracted.'} The organizer’s rules were not checked by Wisht.
      </p>}
      <label className="submission-field">Official organizer rules URL
        <input type="url" value={organizerUrl} placeholder="https://organizer.example/rules"
         maxLength={600} onChange={e=>hasChanged(()=>{setOrganizerUrl(e.target.value);setReviewed(false);})}/>
      </label>
      {absoluteOfficialUrl(organizerUrl)&&<p className="submission-muted">
        <a href={organizerUrl} target="_blank" rel="noopener noreferrer">Open official organizer rules <ExternalLink size={12}/></a>
      </p>}
      <label className="submission-field">Important requirements from the official rules
        <textarea value={rulesNotes} maxLength={2500} rows={4}
          placeholder="Eligibility, fees, exact closing time, file format/resolution, AI restrictions, usage rights, required materials…"
          onChange={e=>hasChanged(()=>{setRulesNotes(e.target.value);setReviewed(false);})}/>
      </label>
      <label className="submission-approval">
        <input type="checkbox" checked={reviewed} onChange={e=>hasChanged(()=>setReviewed(e.target.checked))}/>
        <span>I personally reviewed the organizer’s page for deadline, eligibility, fees, image specifications and usage rights. I understand Wisht has not independently verified those rules.</span>
      </label>
      {!readyForReview&&<p className="submission-warning"><ShieldAlert size={16}/> Rules not confirmed. The draft will be marked for further review, not submission-ready.</p>}
    </section>
    <section className="submission-card">
      <p className="submission-step"><span>02</span> Choose your work</p>
      {!galleries.length?<div className="submission-no-gallery">
         <Images size={23}/>
         <p>No saved photography portfolio is available under this wish. Build one first.</p>
         <button className="primary" type="button" onClick={()=>onBuildPortfolio(wishId)}>Build a portfolio <ArrowRight size={16}/></button>
       </div>:<>
       <label className="submission-field">Source portfolio
         <select value={portfolioId} disabled={Boolean(existingId||savedId)} onChange={e=>changeGallery(e.target.value)}>
          {galleries.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
         </select>
       </label>
       <p className="submission-muted">{picked.length} selected · maximum 8. Only photos marked selected in the saved portfolio can be included.</p>
       <div className="submission-photos">{gallery?.photos.filter(p=>p.selected).map(photo=><label key={photo.id} className="submission-photo">
         {imageUrls[photo.id]?<img src={imageUrls[photo.id]} alt={photo.name}/>:<span className="submission-photo-placeholder">Private photograph</span>}
         <span><input type="checkbox" checked={selectedIds.includes(photo.id)}
          onChange={e=>hasChanged(()=>setSelectedIds(current=>e.target.checked?[...current,photo.id]:current.filter(id=>id!==photo.id)))}/>
         {photo.name}</span>
       </label>)}</div>
       <p className="submission-warning"><ShieldAlert size={16}/> These are optimized WebP previews, capped at 1,600 pixels. They may not meet the organizer’s JPEG, RAW, color-space or resolution requirements. Keep original files available.</p>
       </>}
    </section>
    <section className="submission-card">
     <p className="submission-step"><span>03</span> Write your application</p>
     <label className="submission-field">Your name (optional)
       <input value={artistName} maxLength={120} onChange={e=>hasChanged(()=>setArtistName(e.target.value))} placeholder="As you want to be credited"/>
     </label>
     <label className="submission-field">Artist statement
       <textarea rows={5} maxLength={2500} value={artistStatement}
         onChange={e=>hasChanged(()=>setArtistStatement(e.target.value))}/>
     </label>
     <label className="submission-field">Cover note
       <textarea rows={8} maxLength={4000} value={coverNote}
         onChange={e=>hasChanged(()=>setCoverNote(e.target.value))}/>
     </label>
     <p className="submission-muted">Draft text is assembled only from the saved portfolio and your edits. No invented awards, experience or submission claims.</p>
    </section>
    <section className="submission-card">
     <p className="submission-step"><span>04</span> Save and take it with you</p>
     <div className="submission-state">
      <span className={readyForReview?'submission-state-reviewed':'submission-state-pending'}>
       {readyForReview?'Organizer rules: reviewed by you':'Organizer rules: review outstanding'}
      </span>
      <span>Submission: NOT SENT</span>
     </div>
     <p className="submission-muted">Saving records a private draft and creates a Work Receipt. It does not certify eligibility or submit photographs.</p>
     <button className="primary" disabled={busy||!gallery||picked.length===0||picked.length>8}
       type="button" onClick={()=>void save()}>
       <LockKeyhole size={16}/>{busy?'Working…':savedId?'Save changes':'Save private submission draft'}<ArrowRight size={15}/>
     </button>
     {savedId&&<button className="submission-outline" type="button" disabled={busy||dirty}
       onClick={()=>void download()}><Download size={16}/> Download draft + {picked.length} WebP previews (ZIP)</button>}
     {dirty&&savedId&&<p className="submission-muted">Save changes before downloading the updated package.</p>}
     {notice&&<p className="submission-success">{notice}</p>}
     {savedId&&<>
       <WorkReceipts wishId={wishId} refreshKey={receiptVersion}/>
       <button className="back" type="button" onClick={onSaved}>View My wishes <ArrowRight size={15}/></button>
       <button className="submission-delete" type="button" disabled={busy}
        onClick={()=>void remove()}><Trash2 size={14}/> Delete this draft</button>
     </>}
    </section>
   </div>:<p className="submission-muted">No opportunity was selected.</p>}
 </section>;
}
