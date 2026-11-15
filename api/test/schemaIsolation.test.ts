import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
it('generic wish persistence does not collide with legacy public.wishes', () => {
  const sql=read('supabase/migrations/20261115224928_f03_additive_generic_wish_records.sql');
  assert.match(sql,/create table public\.wish_records\s*\(/);
  assert.doesNotMatch(sql,/create table public\.wishes\s*\(/);
  const startup=read('scripts/dev.mjs');
  assert.match(startup,/table_name = 'wish_records'/);
  assert.match(startup,/20261115224928_f03_additive_generic_wish_records/);
  for(const path of ['web/src/firstWishStore.ts','api/src/firstDeed.ts']) {
    const src=read(path);
    assert.match(src,/\.from\('wish_records'\)/);
    assert.doesNotMatch(src,/\.from\('wishes'\)/);
  }
});
