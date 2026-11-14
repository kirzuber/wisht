import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {diffWatchResults,watchIdentity} from '../src/watchDiff.ts';
import type {Opportunity} from '../src/scout.ts';
const item=(name:string,deadline:string,url:string):Opportunity=>({
 id:name,title:name,deadline,sourceUrl:'https://pixcontests.com/'+url,
 summary:'',feeNote:'not independently verified',relevance:'photography',
 evidence:'calendar_listing',organizerVerified:false
});
describe('Autonomous watch comparison',()=>{
 it('does not call pre-existing listings new on the first baseline',()=>{
  const result=diffWatchResults([item('Call A','2027-03-01','call-a')],[]);
  assert.equal(result.isBaseline,true);
  assert.deepEqual(result.newMatches,[]);
 });
 it('detects truly new listings and changed deadlines',()=>{
  const previous=[item('Call A','2027-03-01','call-a?utm_source=calendar')];
  const current=[item('Call A','2027-04-03','call-a?utm_medium=feed'),
    item('Call B','2027-04-01','call-b')];
  const diff=diffWatchResults(current,[previous]);
  assert.deepEqual(diff.newMatches.map(x=>x.title),['Call B']);
  assert.deepEqual(diff.changedMatches.map(x=>x.title),['Call A']);
 });
 it('does not rediscover an older previously seen call',()=>{
  const a=item('Call A','2027-03-01','call-a'),b=item('Call B','2027-05-01','call-b');
  const diff=diffWatchResults([a],[[b],[a]]);
  assert.equal(diff.newMatches.length,0);
 });
 it('canonicalizes tracking variations',()=>{
  assert.equal(watchIdentity(item('A','2027-03-01','call-a?utm=1')),
    watchIdentity(item('A','2027-03-01','call-a?utm=2')));
 });
});
