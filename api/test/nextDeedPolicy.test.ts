import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {nextDeedFor,type CompletedDeed} from '../../web/src/nextDeedPolicy.ts';
describe('JINN-UX-03 truthful next steps',()=>{
 it('offers real in-app continuation only for photography workflows already implemented',()=>{
  for(const type of ['PHOTO_SHORTLIST_SAVED','PORTFOLIO_PUBLISHED'] as CompletedDeed[]){
   const policy=nextDeedFor(type);
   assert.equal(policy.mode,'in_app');
   assert.ok(policy.label.length>8);
  }
 });
 it('labels careers and soccer next steps as external handoffs, not agent actions',()=>{
  assert.equal(nextDeedFor('CAREER_SHORTLIST_SAVED').mode,'external');
  assert.match(nextDeedFor('CAREER_SHORTLIST_SAVED').note,/leaving Jinn/);
  assert.equal(nextDeedFor('SOCCER_SHORTLIST_SAVED').mode,'external');
  assert.match(nextDeedFor('SOCCER_SHORTLIST_SAVED').note,/not been verified/);
 });
 it('does not claim completed submission, application, or registration',()=>{
  const types:CompletedDeed[]=['PHOTO_SHORTLIST_SAVED','CAREER_SHORTLIST_SAVED','SOCCER_SHORTLIST_SAVED','PORTFOLIO_PUBLISHED'];
  for(const type of types){
   const policy=nextDeedFor(type);
   assert.doesNotMatch(policy.label,/submitted|registered|applied|booked/i);
   assert.ok(policy.title);
  }
 });
});
