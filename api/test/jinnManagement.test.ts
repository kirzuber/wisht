import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toJinnIdentity, validateJinnIdentity } from '../../web/src/jinnStore.ts';

describe('F03-003 owner Jinn identity', () => {
  it('requires a bounded nonblank name and an optional descriptive purpose', () => {
    assert.deepEqual(validateJinnIdentity('  Writing Jinn  ', '  Family stories  '),
      { name: 'Writing Jinn', purpose: 'Family stories' });
    assert.throws(() => validateJinnIdentity('    ', ''), /name between/);
    assert.throws(() => validateJinnIdentity('x'.repeat(61), ''), /name between/);
    assert.throws(() => validateJinnIdentity('Jinn', 'y'.repeat(161)), /under 160/);
  });
  it('maps settings as a descriptive note rather than an executable instruction', () => {
    assert.deepEqual(toJinnIdentity({id:'one',name:'Jinn',is_primary:true,settings:{purpose:'Practice reading'}}),
      {id:'one',name:'Jinn',is_primary:true,purpose:'Practice reading'});
    assert.equal(toJinnIdentity({id:'two',name:'Other',is_primary:false,settings:{purpose:{tool:'run'}}}).purpose,'');
  });
  it('preserves the narrow server context: continuation loads only the requested Wish', () => {
    const source=readFileSync(new URL('../src/firstDeed.ts',import.meta.url),'utf8');
    assert.match(source,/\.from\('wish_records'\)\.select\('id,original_intent'\)/);
    assert.match(source,/\.eq\('id',wishId\)\.eq\('user_id',user\.id\)/);
    assert.match(source,/\.from\('artifacts'\)\.select\('content'\)/);
    // Jinn purpose is explicitly descriptive-only in this story; no new LLM instructions.
    assert.doesNotMatch(source,/jinns\.settings|jinn_purpose|workingPreference/);
  });
});
