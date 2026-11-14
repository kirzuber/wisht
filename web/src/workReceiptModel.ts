export type WorkAction =
  'PRIVATE_GALLERY_CREATED' | 'PUBLIC_LISTING_CREATED' | 'PUBLIC_LISTING_REMOVED' | 'OPPORTUNITY_SHORTLIST_SAVED' | 'SUBMISSION_DRAFT_SAVED' | 'WATCH_CHECK_COMPLETED' | 'CAREER_SHORTLIST_SAVED';
export type WorkReceipt = {
  id: string;
  wish_id: string;
  portfolio_id: string|null;
  shortlist_id?: string|null;
  submission_id?: string|null;
  watch_run_id?: string|null;
  career_shortlist_id?: string|null;
  opportunity_count?: number;
  action: WorkAction;
  photo_count: number;
  public_slug: string | null;
  source: 'database_event' | 'existing_record_backfill';
  recorded_at: string;
};
export type ReceiptDisplay = { title: string; detail: string; privacy: string };

export function receiptDisplay(receipt: WorkReceipt): ReceiptDisplay {
  const count = receipt.photo_count;
  switch(receipt.action){
    case 'CAREER_SHORTLIST_SAVED':
      return {
        title:'Career research shortlist saved',
        detail:(receipt.opportunity_count||0)+' remote job listings were saved under this career wish.',
        privacy:'Source-indexed · AI fit advisory if enabled · employer availability not independently confirmed'
      };
    case 'WATCH_CHECK_COMPLETED':
      return {
        title:'Scheduled opportunity check completed',
        detail:'The watch saved a source-check record identifying '+(receipt.opportunity_count||0)+' new or changed indexed listing(s).',
        privacy:'Source-indexed only · organizer rules and eligibility not independently verified'
      };
    case 'SUBMISSION_DRAFT_SAVED':
      return {
        title:'Private submission draft saved',
        detail:'An editable preparation package referencing '+count+' selected photo '+(count===1?'preview':'previews')+' was saved.',
        privacy:'Private draft · not submitted · organizer terms not certified'
      };
    case 'OPPORTUNITY_SHORTLIST_SAVED':
      return {
        title:'Opportunity shortlist saved',
        detail:(receipt.opportunity_count||0)+' source-indexed opportunity listings were saved under this wish.',
        privacy:'Private research · organizer terms not independently verified'
      };
    case 'PRIVATE_GALLERY_CREATED':
      return {
        title:'Private gallery saved',
        detail:`A private portfolio record containing ${count} photo ${count===1?'entry':'entries'} was created.`,
        privacy:'Private · only your verified account'
      };
    case 'PUBLIC_LISTING_CREATED':
      return {
        title:'Public gallery listed',
        detail:`A public portfolio record with ${count} approved photo ${count===1?'entry':'entries'} was created.`,
        privacy:'Public at the time · current availability may differ'
      };
    case 'PUBLIC_LISTING_REMOVED':
      return {
        title:'Public listing removed',
        detail:`The public listing of ${count} photo ${count===1?'entry':'entries'} was deleted. Public caches may persist temporarily.`,
        privacy:'Listing removed · private draft retained'
      };
  }
}
