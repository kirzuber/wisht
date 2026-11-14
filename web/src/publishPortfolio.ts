import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import type { PortfolioPhoto } from './photoProcessing';

import { publicPath, publicGalleryPath, selectedForPublication, type PortfolioPublication, type PublicPhoto } from './portfolioPublicationModel';

export { publicPath, publicGalleryPath, selectedForPublication };
export type { PortfolioPublication, PublicPhoto };
export const PUBLIC_BUCKET = 'portfolio-public';
const PRIVATE_BUCKET = 'portfolio-previews';
export function publicImageUrl(path: string): string {
  return getSupabase().storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function findPublication(portfolioId: string): Promise<PortfolioPublication | null> {
  const { data, error } = await getSupabase().from('portfolio_publications')
    .select('portfolio_id,slug,title,introduction,photos,published_at')
    .eq('portfolio_id',portfolioId).maybeSingle();
  if (error) throw error;
  return data as PortfolioPublication | null;
}

/** Explicit user approval is required in the UI before this function is called.
 * No secret/service-role key and no operation on arbitrary client-supplied photo paths.
 */
export async function publishPortfolio(portfolioId: string): Promise<PortfolioPublication> {
  const user = await getAuthenticatedUser();
  const db = getSupabase();
  const existing = await findPublication(portfolioId);
  if (existing) throw new Error('This portfolio is already live. Unpublish it before republishing.');

  const { data, error: readError } = await db.from('portfolios')
    .select('id,title,introduction,photos,user_id').eq('id',portfolioId).single();
  if (readError || !data || data.user_id !== user.id) throw new Error('Private portfolio not found for this account.');
  const selected = selectedForPublication(data.photos as PortfolioPhoto[]);
  if (!selected.length) throw new Error('Select at least one photograph and save your draft before publishing.');

  const publicStorage=db.storage.from(PUBLIC_BUCKET);
  const privateStorage=db.storage.from(PRIVATE_BUCKET);
  const copied:string[]=[];
  try {
    const publicPhotos:PublicPhoto[]=[];
    for (const [index,photo] of selected.entries()) {
      const { data: image, error: downloadError }=await privateStorage.download(photo.path);
      if (downloadError || !image) throw downloadError || new Error('A private photograph cannot be opened.');
      const path=publicPath(user.id, portfolioId, photo.id);
      const {error:uploadError}=await publicStorage.upload(path,image,{
        upsert:false,contentType:'image/webp',cacheControl:'60'
      });
      if (uploadError) throw uploadError;
      copied.push(path);
      // The public asset must actually be reachable, not just have a constructed URL.
      const check=await fetch(publicImageUrl(path),{method:'GET',cache:'no-store'});
      if (!check.ok) throw new Error('Could not verify a public image. Publication was stopped.');
      publicPhotos.push({id:photo.id,path,label:`Photo ${index+1}`});
    }
    const slug=crypto.randomUUID().replace(/-/g,'').slice(0,16);
    const {error:publishError}=await db.from('portfolio_publications').insert({
      portfolio_id:portfolioId,user_id:user.id,slug,title:data.title,
      introduction:data.introduction,photos:publicPhotos
    });
    if (publishError) throw publishError;
    const confirmed=await findPublication(portfolioId);
    if(!confirmed || confirmed.slug !== slug)throw new Error('Cannot verify the public gallery record.');
    return confirmed;
  } catch(cause) {
    // Do not remove already published files on a successful insert followed by a
    // temporary verification failure: that would leave a broken public gallery.
    const published=await findPublication(portfolioId).catch(()=>null);
    if(!published && copied.length){
      const {error:cleanupError}=await publicStorage.remove(copied);
      if(cleanupError)throw new Error('Publication failed and uploaded public copies could not be cleaned up. Please contact support before retrying.');
    }
    if(published)return published;
    throw cause;
  }
}

/** Remove public files and snapshot; private draft remains intact.
 * Removes the public assets first to fail closed if DB deletion fails.
 */
export async function unpublishPortfolio(portfolioId: string): Promise<void> {
  const user=await getAuthenticatedUser();
  const current=await findPublication(portfolioId);
  if(!current)return;
  const prefix=`${user.id}/${portfolioId}/`;
  const paths=current.photos.map(photo=>photo.path);
  if(paths.some(path=>!path.startsWith(prefix)))throw new Error('Public image ownership could not be verified.');

  const db=getSupabase();
  const {error:filesError}=await db.storage.from(PUBLIC_BUCKET).remove(paths);
  if(filesError)throw filesError;
  const {data,error:removeError}=await db.from('portfolio_publications')
    .delete().eq('portfolio_id',portfolioId).select('portfolio_id').single();
  if(removeError || !data)throw removeError || new Error('Could not confirm publication removal.');
  const again=await findPublication(portfolioId);
  if(again)throw new Error('Unpublish could not be verified.');
}
