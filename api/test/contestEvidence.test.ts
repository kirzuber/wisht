import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {validatedListingUrl,extractOfficialUrl,inspectIndexedListing} from '../src/contestEvidence.ts';
const html='<html><a rel="nofollow" href="https://organizer.example/2027/rules?x=1&amp;y=2">Visit official page</a></html>';
describe('Safe indexed opportunity inspection',()=>{
 it('only allows strict provider listing paths',()=>{
  assert.equal(validatedListingUrl('https://pixcontests.com/sample-open-call'),'https://pixcontests.com/sample-open-call');
  for(const url of ['http://pixcontests.com/x','https://pixcontests.com@127.0.0.1/x','https://pixcontests.com/calendar/free.ics','https://pixcontests.com/anything?redirect=1','http://127.0.0.1/admin']){
   assert.throws(()=>validatedListingUrl(url));
  }
 });
 it('extracts official page link but does not visit it',()=>{
  assert.equal(extractOfficialUrl(html),'https://organizer.example/2027/rules?x=1&y=2');
  assert.equal(extractOfficialUrl('<html>no links</html>'),null);
  assert.equal(extractOfficialUrl('<a href="http://localhost/private">Visit official page</a>'),null);
 });
 it('fetches only the allowlisted index and labels organizer unverified',async()=>{
  let requested='';
  const fake=(async(value:RequestInfo|URL)=>{
    requested=String(value);
    return new Response(html,{status:200});
  }) as typeof fetch;
  const result=await inspectIndexedListing('https://pixcontests.com/sample-open-call',fake,new Date('2026-11-14T15:00:00Z'));
  assert.equal(requested,'https://pixcontests.com/sample-open-call');
  assert.equal(result.organizerStatus,'NOT_CHECKED');
  assert.equal(result.officialUrl,'https://organizer.example/2027/rules?x=1&y=2');
 });
 it('does not follow redirect or report evidence when index fails',async()=>{
  await assert.rejects(()=>inspectIndexedListing('https://pixcontests.com/test-call',
    (async()=>new Response(null,{status:302})) as typeof fetch),/could not be read/);
 });
});
