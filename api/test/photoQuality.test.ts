import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickInitialSelection, technicalScore } from '../../web/src/photoQuality.ts';

describe('Private portfolio technical curation', () => {
  it('prefers better resolution and exposure', () => {
    assert.ok(technicalScore(2800, 2000, 127, 35, 22) > technicalScore(400, 400, 5, 2, 1));
  });
  it('selects top-scoring photos, without mutating original ordering', () => {
    const original = [{ id: 'a', score: 40 }, { id: 'b', score: 90 }, { id: 'c', score: 60 }];
    assert.deepEqual(pickInitialSelection(original, 2), ['b', 'c']);
    assert.deepEqual(original.map(x => x.id), ['a', 'b', 'c']);
  });
  it('handles empty sets and bounded selection counts', () => {
    assert.deepEqual(pickInitialSelection([]), []);
    assert.deepEqual(pickInitialSelection([{ id: 'a', score: 1 }], 0), []);
  });
});
