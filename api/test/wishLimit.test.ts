import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SAVED_WISHES, wishesRemaining } from '../../web/src/wishLimit.ts';

describe('Three saved wishes entitlement', () => {
  it('allows saving until the three slots are occupied', () => {
    assert.equal(MAX_SAVED_WISHES, 3);
    assert.equal(wishesRemaining(0), 3);
    assert.equal(wishesRemaining(2), 1);
    assert.equal(wishesRemaining(3), 0);
  });
  it('never suggests free slots for legacy over-cap accounts', () => {
    assert.equal(wishesRemaining(4), 0);
    assert.equal(wishesRemaining(100), 0);
  });
});
