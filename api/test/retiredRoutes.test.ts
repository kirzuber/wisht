import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import retired, { config } from '../../netlify/functions/retired.mts';

describe('retired vertical routes',()=>{
 it('returns a clear gone response for old API and public gallery paths',async()=>{
  assert.deepEqual(config.path,[
   '/api/interpret','/api/examples','/api/scout','/api/opportunity-detail',
   '/api/career-scout','/api/soccer-scout','/p/*'
  ]);
  const response=await retired();
  assert.equal(response.status,410);
  assert.match((await response.json()).error,/retired/);
 });
});
