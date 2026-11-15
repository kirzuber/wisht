import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadOptionalSavedRows, loadSavedWishRows, type SavedWish } from '../../web/src/savedWishRows.ts';

const existing: SavedWish[] = ['photography', 'career', 'soccer'].map((kind, index) => ({
  id: `wish-${index}`, aspiration: `${kind} wish`, kind, mission_id: 'legacy-mission',
  answer: 'legacy-answer', status: 'PLANNED', created_at: '2026-11-14T00:00:00Z'
}));

describe('saved wish library migration compatibility', () => {
  it('keeps existing wishes visible and reports the real missing-column error', async () => {
    const result = await loadSavedWishRows(
      async () => ({ data: existing, error: null }),
      async () => ({ data: null, error: { code: '42703', message: 'column wishes.first_artifact does not exist' } })
    );
    assert.deepEqual(result.wishes, existing);
    assert.equal(result.artifactStatus, 'migration-missing');
    assert.match(result.warning || '', /first_artifact does not exist/);
    assert.match(result.warning || '', /F02-001 migration/);
  });

  it('joins first artifacts to their exact wish after migration', async () => {
    const result = await loadSavedWishRows(
      async () => ({ data: existing, error: null }),
      async ids => {
        assert.deepEqual(ids, existing.map(wish => wish.id));
        return { data: [{ id: 'wish-1', first_artifact: { title: 'Career plan' } }], error: null };
      }
    );
    assert.equal(result.warning, null);
    assert.equal(result.artifactStatus, 'available');
    assert.deepEqual(result.wishes[1].first_artifact, { title: 'Career plan' });
    assert.equal(result.wishes[0].first_artifact, undefined);
    assert.equal(result.wishes[2].first_artifact, undefined);
  });

  it('treats a primary wish-query failure as an error, never an empty library', async () => {
    await assert.rejects(
      loadSavedWishRows(
        async () => ({ data: null, error: { code: '42501', message: 'permission denied for wishes' } }),
        async () => { throw new Error('artifact query must not run'); }
      ),
      { code: '42501', message: 'permission denied for wishes' }
    );
  });

  it('keeps wishes visible but marks a transient artifact failure as unavailable', async () => {
    const result = await loadSavedWishRows(
      async () => ({ data: existing, error: null }),
      async () => { throw new Error('network unavailable'); }
    );
    assert.equal(result.wishes.length, 3);
    assert.equal(result.artifactStatus, 'unavailable');
    assert.match(result.warning || '', /network unavailable/);
  });

  it('reports a secondary table failure without failing the primary list', async () => {
    const primary = await loadSavedWishRows(
      async () => ({ data: existing, error: null }),
      async () => ({ data: [], error: null })
    );
    const secondary = await loadOptionalSavedRows('Career shortlists',
      Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } }));
    assert.equal(primary.wishes.length, 3);
    assert.deepEqual(secondary.rows, []);
    assert.match(secondary.warning || '', /Career shortlists could not load: permission denied/);
  });
});
