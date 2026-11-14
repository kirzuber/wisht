import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { duplicateWishGroups, matchingWish, normalizedWish } from '../../web/src/wishDedup.ts';

describe('Context-aware, bounded wish deduplication', () => {
  it('normalizes equivalent casing, whitespace, and punctuation', () => {
    assert.equal(normalizedWish('  I WANT  to play SOCCER! '), normalizedWish('i want to play soccer'));
  });
  it('recognizes same soccer aspiration with different wording and missions', () => {
    const saved = [{id:'1',kind:'soccer',aspiration:'I want to play soccer',mission_id:'watch-tryouts'}];
    assert.equal(matchingWish({kind:'soccer',aspiration:'I want to join a football team'},saved)?.id,'1');
  });
  it('recognizes different ways to express a photography dream', () => {
    const saved = [{id:'2',kind:'photography',aspiration:'I want to be a photographer'}];
    assert.equal(matchingWish({kind:'photography',aspiration:'I would love to do photography'},saved)?.id,'2');
  });
  it('does not mix unrelated supported aspiration families', () => {
    const saved = [{kind:'soccer',aspiration:'I want to play soccer'}];
    assert.equal(matchingWish({kind:'career',aspiration:'I want a new career'},saved),undefined);
  });
  it('does not over-merge all sensitive or creative aspirations', () => {
    const saved = [{kind:'personal',aspiration:'I want to explore my gender'}];
    assert.equal(matchingWish({kind:'personal',aspiration:'I want to move to another city'},saved),undefined);
  });
  it('identifies existing duplicate groups without changing or deleting records', () => {
    const saved = [
      {id:'1',kind:'soccer',aspiration:'I want to play soccer'},
      {id:'2',kind:'soccer',aspiration:'I would like to play football'},
      {id:'3',kind:'career',aspiration:'I want to change jobs'},
      {id:'4',kind:'soccer',aspiration:'I want to become a soccer player'}
    ];
    assert.deepEqual(duplicateWishGroups(saved).map(x=>x.map(y=>y.id)),[['1','2','4']]);
    assert.equal(saved.length,4);
  });
});
