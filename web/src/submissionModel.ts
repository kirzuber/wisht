import type { PortfolioPhoto } from './photoProcessing';
export type PhotoSelection=Pick<PortfolioPhoto,'id'|'path'|'name'>;
export type SubmissionRow={
 id:string;wish_id:string;shortlist_id:string;portfolio_id:string;
 opportunity_id:string;opportunity_title:string;deadline:string;listing_url:string;
 organizer_url:string;rules_notes:string;reviewed_by_user:boolean;
 artist_name:string;artist_statement:string;cover_note:string;
 selected_photos:PhotoSelection[];created_at:string;updated_at:string
};
export function proposedCoverNote(input:{
  opportunityTitle:string;portfolioTitle:string;introduction:string;artistName:string
}):string{
 const intro=input.introduction.trim();
 return [
   'Subject: Photography submission — '+input.opportunityTitle,
   '',
   'Hello,',
   '',
   'I would like to present a selection from my photography portfolio, "'+input.portfolioTitle+'", for consideration.',
   intro ? '' : undefined,
   intro || undefined,
   '',
   'Please find my selected works and portfolio information attached. I will confirm the submission format, eligibility, fees and rights against the official rules before submitting.',
   '',
   'Thank you for considering my work.',
   input.artistName.trim() || '[Photographer name]'
 ].filter(v=>v!==undefined).join('\n');
}
export function selectedPhotoManifest(photos:PortfolioPhoto[]):PhotoSelection[]{
 return photos.filter(photo=>photo.selected).map(photo=>({id:photo.id,path:photo.path,name:photo.name}));
}
export function safeFilePart(raw:string):string{
 const output=raw.normalize('NFKD').replace(/[^a-zA-Z0-9-_]+/g,'-')
  .replace(/^-+|-+$/g,'').slice(0,65);
 return output||'photograph';
}
export function packageMarkdown(input:{
 opportunityTitle:string;deadline:string;listingUrl:string;organizerUrl:string;
 rulesNotes:string;reviewedByUser:boolean;artistName:string;artistStatement:string;
 coverNote:string;photoNames:string[];portfolioTitle:string
}):string{
 const text=[
  '# Photography submission preparation — '+input.opportunityTitle,
  '',
  '**Status:** PRIVATE DRAFT — NOT SUBMITTED',
  '**Listing deadline (not independently reconfirmed):** '+input.deadline,
  '**Source listing:** '+input.listingUrl,
  '**Organizer rules page:** '+(input.organizerUrl||'NOT PROVIDED — review required'),
  '**Rule review:** '+(input.reviewedByUser?'User reports reviewing the organizer’s official rules. Wisht has not independently validated them.':'NOT CONFIRMED — do not submit without review'),
  '',
  '## Requirement notes (entered by user)',
  input.rulesNotes||'Not yet provided. Check eligibility, deadline time zone, fee, image format/resolution, AI restrictions and licensing rights.',
  '',
  '## Photographer',
  input.artistName||'[Name required]',
  '',
  '## Artist statement — editable draft',
  input.artistStatement||'[Write a factual artist statement here.]',
  '',
  '## Cover note — editable draft',
  input.coverNote,
  '',
  '## Selected photography',
  'Portfolio: '+input.portfolioTitle,
  ...input.photoNames.map((name,index)=>String(index+1)+'. '+name),
  '',
  '## Before you submit',
  '- Reopen the organizer’s official page; confirm the precise deadline and time zone.',
  '- Confirm eligibility, entry fees, licensing / usage rights and any AI-photo rules.',
  '- Replace these **WebP preview files** with originals if JPG, higher resolution, color-space, RAW or other specifications are required.',
  '- Check individual filenames, image count, aspect ratios and any category rules.',
  '- Submit manually at the official organizer portal; Wisht has not contacted anyone or submitted anything.'
 ];
 return text.join('\n');
}
