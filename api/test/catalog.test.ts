import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import {interpretWish} from '../src/catalog.ts';

describe('JINN-001 deterministic intent routing',()=>{
  it('routes known aspirations to actionable mission choices',()=>{
    for(const wish of ['I want to be a photographer','I want a new career','I want to play soccer','I want to be independent']){
      const res=interpretWish(wish);
      assert.equal(res.supported,true,wish);
      assert.ok(res.missions.length>=2,wish);
      assert.ok(res.missions.every(m=>m.question&&m.choices.length>=2&&m.deliverables.length>0));
    }
  });
  it('treats intimate gender-related aspirations discreetly',()=>{
    const r=interpretWish('I want to be a woman');
    assert.equal(r.kind,'personal');assert.equal(r.tone,'discreet');
    assert.ok(r.missions.every(m=>!m.permission.includes('publicly')));
  });
  it('keeps jokes playful, with real but bounded creative options',()=>{
    assert.equal(interpretWish('I want to be a king').tone,'playful');
    assert.equal(interpretWish('I want to be a frog').tone,'playful');
  });
  it('does not fabricate capabilities for unsupported desires',()=>{
    const r=interpretWish('I want to live on Neptune');
    assert.equal(r.supported,false);assert.equal(r.missions.length,0);
  });
  it('does not mistake a wealth aspiration for a joke',()=>{
    assert.equal(interpretWish('I want to become a millionaire').kind,'finance');
  });
});
