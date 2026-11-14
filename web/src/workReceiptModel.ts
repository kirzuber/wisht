export type WorkAction =
  'PRIVATE_GALLERY_CREATED' | 'PUBLIC_LISTING_CREATED' | 'PUBLIC_LISTING_REMOVED' | 'OPPORTUNITY_SHORTLIST_SAVED';
export type WorkReceipt = {
  id: string;
  wish_id: string;
  portfolio_id: string|null;
  shortlist_id?: string|null;
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
