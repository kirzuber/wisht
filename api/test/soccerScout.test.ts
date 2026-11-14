import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {findSoccerClubs,validateSoccerInput,VERIFIED_CLUBS} from '../src/soccerCatalogue.js';
import {serveSoccerScout} from '../src/soccerService.js';
describe('JINN-004.2 verified club catalogue',()=>{
 it('finds documented youth programs, never live registrations',()=>{
  const found=findSoccerClubs({city:'Burlington',level:'beginner',ageGroup:'youth'},new Date('2026-11-14T00:00:00Z'));
  assert.equal(found.clubs.length,1);
  assert.equal(found.clubs[0].name,'Burlington Soccer Club');
  assert.equal(found.clubs[0].evidence,'program_documented');
  assert.match(found.evidenceScope,/NOT been verified/);
 });
 it('is narrow about geographical coverage and never invents an unrelated club',()=>{
  const empty=findSoccerClubs({city:'Hamilton',level:'recreational',ageGroup:'adult'});
  assert.equal(empty.clubs.length,0);
  assert.match(empty.coverage,/pilot catalogue/);
 });
 it('filters adult and competitive against documented programs',()=>{
  const adult=findSoccerClubs({city:'Oakville',level:'competitive',ageGroup:'adult'});
  assert.equal(adult.clubs.length,0);
  const youth=findSoccerClubs({city:'Oakville',level:'competitive',ageGroup:'youth'});
  assert.equal(youth.clubs.length,1);
 });
 it('source records have official HTTPS links, unique IDs and stable verification dates',()=>{
  assert.equal(new Set(VERIFIED_CLUBS.map(c=>c.id)).size,VERIFIED_CLUBS.length);
  for(const club of VERIFIED_CLUBS){
   assert.equal(new URL(club.sourceUrl).protocol,'https:');
   assert.equal(new URL(club.programUrl).protocol,'https:');
   assert.equal(club.verifiedAt,'2026-11-14');
  }
 });
 it('validates user-controlled input and rejects injection',()=>{
  assert.deepEqual(validateSoccerInput({city:' Toronto ',level:'beginner',ageGroup:'adult'}),{city:'Toronto',level:'beginner',ageGroup:'adult'});
  assert.throws(()=>validateSoccerInput({city:'<script>',level:'beginner',ageGroup:'adult'}));
  assert.throws(()=>validateSoccerInput({city:'Burlington',level:'pro',ageGroup:'adult'}));
 });
 it('serves anonymous discovery and returns a bounded response',async()=>{
  const response=await serveSoccerScout(new Request('https://example.com/api/soccer-scout',{method:'POST',body:JSON.stringify({city:'Ottawa',level:'recreational',ageGroup:'adult'})}));
  assert.equal(response.status,200);
  const data=await response.json() as {clubs:unknown[]};
  assert.ok(data.clubs.length>0&&data.clubs.length<=5);
 });
});
