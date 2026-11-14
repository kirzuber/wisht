import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { receiptDisplay, type WorkReceipt } from '../../web/src/workReceiptModel.ts';

const receipt=(action:WorkReceipt['action'],photo_count=3):WorkReceipt=>({
  id:'evt',wish_id:'w',portfolio_id:'p',action,photo_count,public_slug:null,
  source:'database_event',recorded_at:'2026-11-14T18:00:00Z'
});

describe('Truthful work receipts',()=>{
  it('reports database evidence, not externally verified availability',()=>{
    const status=receiptDisplay(receipt('PUBLIC_LISTING_CREATED'));
    assert.match(status.title,/public gallery/i);
    assert.match(status.detail,/public portfolio record/i);
    assert.match(status.privacy,/may differ/i);
  });
  it('does not claim immediate CDN erasure on unpublish',()=>{
    const status=receiptDisplay(receipt('PUBLIC_LISTING_REMOVED'));
    assert.match(status.detail,/caches may persist/i);
  });
  it('labels career shortlist as source-indexed rather than employer-confirmed',()=>{
    const value=receiptDisplay({...receipt('CAREER_SHORTLIST_SAVED',0),opportunity_count:3});
    assert.match(value.detail,/3 remote job/);
    assert.match(value.privacy,/not independently confirmed/);
  });
  it('does not claim source-index results are organizer verified',()=>{
    const result=receiptDisplay({...receipt('WATCH_CHECK_COMPLETED',0),opportunity_count:2});
    assert.match(result.title,/scheduled opportunity check/i);
    assert.match(result.detail,/2 new or changed/i);
    assert.match(result.privacy,/not independently verified/);
  });
  it('does not claim a prepared submission was sent',()=>{
    const result=receiptDisplay(receipt('SUBMISSION_DRAFT_SAVED',2));
    assert.match(result.title,/draft saved/i);
    assert.match(result.privacy,/not submitted/i);
    assert.match(result.detail,/2 selected photo previews/i);
  });
  it('labels private gallery persistence without claiming public delivery',()=>{
    const status=receiptDisplay(receipt('PRIVATE_GALLERY_CREATED'));
    assert.match(status.privacy,/Private/i);
    assert.match(status.detail,/3 photo entries/);
  });
});
