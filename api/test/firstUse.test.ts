import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {interpretWish} from '../src/catalog.ts';
import {autoStartMission,executableMissions,firstUseRoute} from '../../web/src/firstUse.ts';

describe('JINN-UX-01 concise first use',()=>{
 it('enters career and soccer work without a mission-plan detour',()=>{
  const career=interpretWish('I want a new career');
  const soccer=interpretWish('I want to play soccer');
  assert.equal(autoStartMission(career.missions)?.id,'career-scout');
  assert.equal(autoStartMission(soccer.missions)?.id,'find-team');
  assert.equal(firstUseRoute('career-scout'),'career-scout');
  assert.equal(firstUseRoute('find-team'),'soccer-scout');
 });
 it('offers only two real photography choices, not an unfinished offer',()=>{
  const photo=interpretWish('I want to be a photographer');
  assert.deepEqual(executableMissions(photo.missions).map(m=>m.id),
   ['build-portfolio','find-photo-opportunities']);
  assert.equal(autoStartMission(photo.missions),null);
 });
 it('never treats planned or unsupported skills as executable',()=>{
  const independent=interpretWish('I want to be independent');
  assert.equal(executableMissions(independent.missions).length,0);
  assert.equal(autoStartMission(independent.missions),null);
  const unknown=interpretWish('I want to live on Neptune');
  assert.equal(autoStartMission(unknown.missions),null);
  for(const id of ['training-plan','career-application','watch-tryouts','photography-offer']){
    assert.equal(firstUseRoute(id),null);
  }
 });
 it('does not force sign-in just to search; a gallery must be user-selected',()=>{
  assert.equal(autoStartMission([{id:'build-portfolio'}]),null);
  assert.equal(firstUseRoute('build-portfolio'),'portfolio');
 });
});
