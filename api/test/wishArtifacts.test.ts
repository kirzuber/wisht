import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { artifactsForWish } from '../../web/src/wishArtifacts.ts';

describe('One root wish can own multiple portfolios',()=>{
  it('groups multiple artifacts under their exact parent wish',()=>{
    const wish={id:'photography'};
    const artifacts=[
      {id:'one',wish_id:'photography'}, {id:'two',wish_id:'photography'},
      {id:'three',wish_id:'soccer'}
    ];
    assert.deepEqual(artifactsForWish(wish, artifacts).map(p=>p.id),['one','two']);
  });
  it('does not mix unrelated artifacts into this wish',()=>{
    assert.deepEqual(artifactsForWish({id:'career'},[{wish_id:'photography'}]),[]);
  });
});
