import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {validatedListingUrl,extractOfficialUrl,inspectIndexedListing} from '../src/contestEvidence.ts';
const html='<html><a rel="nofollow" href="https://organizer.example/2027/rules?x=1&amp;y=2">Visit official page</a></html>';
describe('Safe indexed opportunity inspection',()=>{
 it('only allows strict provider listing paths',()=>{
  assert.equal(validatedListingUrl('https://pixcontests.com/sample-open-call'),'https://pixcontests.com/sample-open-call');
  // Regression: the public Pixcontests iCalendar adds these UTM parameters.
  assert.equal(
    validatedListingUrl('https://pixcontests.com/people-virtual-3d-exhibition-2026?utm_source=calendar&utm_medium=feed'),
    'https://pixcontests.com/people-virtual-3d-exhibition-2026'
  );
  assert.equal(
    validatedListingUrl('https://www.pixcontests.com/people-virtual-3d-exhibition-2026?utm_campaign=feed#overview'),
    'https://pixcontests.com/people-virtual-3d-exhibition-2026'
  );
  for(const url of ['http://pixcontests.com/x','https://pixcontests.com@127.0.0.1/x','https://pixcontests.com/calendar/free.ics','https://pixcontests.com/calendar/free.ics?utm_source=calendar','http://127.0.0.1/admin']){
   assert.throws(()=>validatedListingUrl(url));
  }
 });
 it('drops all untrusted query data before fetching the source listing',async()=>{
  const input='https://pixcontests.com/people-virtual-3d-exhibition-2026?utm_source=calendar&utm_medium=feed&redirect=https://evil.invalid/';
  let requested='';
  const fake=(async(value:RequestInfo|URL)=>{
    requested=String(value);
    return new Response(html,{status:200});
  }) as typeof fetch;
  await inspectIndexedListing(input,fake);
  assert.equal(requested,'https://pixcontests.com/people-virtual-3d-exhibition-2026');
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
