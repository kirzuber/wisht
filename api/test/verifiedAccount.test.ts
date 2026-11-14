import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedAccount } from '../../web/src/supabaseClient.ts';

describe('Verified-account content gate', () => {
  it('accepts confirmed permanent email accounts', () => {
    assert.equal(isVerifiedAccount({
      is_anonymous: false,
      email: 'example@test.invalid',
      email_confirmed_at: '2026-11-14T18:00:00Z'
    }), true);
  });
  it('rejects anonymous users, even when they have authenticated JWTs', () => {
    assert.equal(isVerifiedAccount({
      is_anonymous: true,
      email: 'example@test.invalid',
      email_confirmed_at: '2026-11-14T18:00:00Z'
    }), false);
  });
  it('rejects unconfirmed email and missing sessions', () => {
    assert.equal(isVerifiedAccount({ is_anonymous: false, email: 'example@test.invalid', email_confirmed_at: undefined }), false);
    assert.equal(isVerifiedAccount(null), false);
  });
});
