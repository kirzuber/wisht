import type { PortfolioPhoto } from './photoProcessing';

/** Pure helpers for public portfolio snapshot, shared with unit tests. */
export type PublicPhoto = { id: string; path: string; label: string };
export type PortfolioPublication = {
  portfolio_id: string;
  slug: string;
  title: string;
  introduction: string;
  photos: PublicPhoto[];
  published_at: string;
};

const PUBLIC_SLUG_PATTERN=/^[a-f0-9]{16}$/;

export function publicPath(ownerId:string, portfolioId:string, photoId:string):string {
  return `${ownerId}/${portfolioId}/${photoId}.webp`;
}
export function publicGalleryPath(slug:string):string {
  if(!PUBLIC_SLUG_PATTERN.test(slug))throw new Error('Invalid public gallery address.');
  return `/p/${slug}`;
}
export function selectedForPublication(photos:PortfolioPhoto[]):PortfolioPhoto[] {
  return photos.filter(photo=>photo.selected).slice(0,8);
}
