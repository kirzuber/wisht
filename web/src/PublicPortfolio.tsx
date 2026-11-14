import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Globe, LockKeyhole } from 'lucide-react';
import { getSupabase } from './supabaseClient';
import { publicImageUrl, type PortfolioPublication } from './publishPortfolio';
import './publicPortfolio.css';

export default function PublicPortfolio({ slug }: { slug: string }) {
  const [gallery,setGallery]=useState<PortfolioPublication|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try {
        const {data,error:readError}=await getSupabase().from('portfolio_publications')
          .select('portfolio_id,slug,title,introduction,photos,published_at')
          .eq('slug',slug).maybeSingle();
        if(readError)throw readError;
        if(!data)throw new Error('This gallery is unavailable or has been unpublished.');
        if(active)setGallery(data as PortfolioPublication);
      }catch(cause){
        if(active)setError(cause instanceof Error?cause.message:'Gallery unavailable.');
      }finally{if(active)setLoading(false);}
    };
    void load();
    return()=>{active=false;};
  },[slug]);

  return <div className="public-page">
    <header className="public-page-nav">
      <a href="/" aria-label="Wisht home"><Camera size={18}/> wisht<span>.</span></a>
      <small><Globe size={14}/> A public photography portfolio</small>
    </header>
    <main className="public-page-main">
      {loading ? <p className="public-gallery-loading">Opening the gallery…</p> :
       error || !gallery ?
       <section className="public-page-empty"><LockKeyhole size={30}/><h1>Gallery unavailable</h1><p>{error||'This gallery has been unpublished.'}</p><a href="/"><ArrowLeft size={15}/> Back to Wisht</a></section> :
       <>
         <div className="public-page-hero">
           <p className="eyebrow">PHOTOGRAPHY PORTFOLIO</p>
           <h1>{gallery.title}</h1>
           {gallery.introduction && <p>{gallery.introduction}</p>}
         </div>
         <div className="public-photo-grid">
           {gallery.photos.map((photo,index)=><img src={publicImageUrl(photo.path)}
             alt={photo.label||`Portfolio photograph ${index+1}`} loading={index<2?'eager':'lazy'} key={photo.id}/>)}
         </div>
         <p className="public-page-credit">Published with Wisht · {gallery.photos.length} photographs</p>
       </>}
    </main>
  </div>;
}
