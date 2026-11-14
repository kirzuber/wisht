import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {parseIcalendar,scanPhotoOpportunities} from '../src/scout.ts';
const fixture="BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:123@pixcontests.com\nDTSTART;VALUE=DATE:20271220\nSUMMARY:Open Theme Photography Call\nDESCRIPTION:Open theme. Everyone can submit to this free exhibition.\nURL:https://pixcontests.com/contests/open-theme-photo\nEND:VEVENT\nBEGIN:VEVENT\nUID:456@pixcontests.com\nDTSTART;VALUE=DATE:20271216\nSUMMARY:Wildlife Nature Photography Awards\nDESCRIPTION:Nature and wildlife categories, free to enter.\nURL:https://pixcontests.com/contests/nature-wildlife\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20250921\nSUMMARY:Expired Photography Call\nURL:https://pixcontests.com/contests/old-event\nEND:VEVENT\nEND:VCALENDAR";
const clock=new Date('2026-11-14T12:00:00Z');
describe('Bounded public opportunity scout',()=>{
 it('parses iCalendar events and removes expired deadlines',()=>{
  const result=parseIcalendar(fixture,{genre:'any',freeOnly:true},clock);
  assert.equal(result.opportunities.length,2);
  assert.equal(result.opportunities[0].deadline,'2027-12-16');
  assert.equal(result.opportunities[0].organizerVerified,false);
  assert.match(result.evidenceScope,/not been independently verified/i);
 });
 it('filters to a photographic subject',()=>{
  assert.deepEqual(parseIcalendar(fixture,{genre:'nature',freeOnly:true},clock).opportunities.map(x=>x.title),['Wildlife Nature Photography Awards']);
 });
 it('accepts a source-index listing URL in the event description when URL field is omitted',()=>{
  const modified=fixture
    .replace('URL:https://pixcontests.com/contests/open-theme-photo','')
    .replace('DESCRIPTION:Open theme. Everyone can submit to this free exhibition.',
      'DESCRIPTION:Open theme. Learn more at https://pixcontests.com/contests/open-theme-photo');
  const result=parseIcalendar(modified,{genre:'open',freeOnly:true},clock);
  assert.equal(result.opportunities.length,1);
  assert.equal(result.opportunities[0].sourceUrl,'https://pixcontests.com/contests/open-theme-photo');
 });
 it('rejects arbitrary/unsafe URLs from a calendar',()=>{
  const hostile=fixture.replace('https://pixcontests.com/contests/open-theme-photo','http://127.0.0.1/admin');
  assert.equal(parseIcalendar(hostile,{genre:'any',freeOnly:true},clock).opportunities.length,1);
 });
 it('does not fabricate matches',()=>assert.equal(parseIcalendar(fixture,{genre:'portrait',freeOnly:false},clock).opportunities.length,0));
 it('uses advertised public calendar without credentials',async()=>{
  let endpoint='';
  const fake=(async(input:RequestInfo|URL)=>{
   endpoint=String(input);return new Response(fixture,{status:200,headers:{'content-type':'text/calendar'}});
  }) as typeof fetch;
  const result=await scanPhotoOpportunities({genre:'any',freeOnly:true},fake,clock);
  assert.equal(endpoint,'https://pixcontests.com/calendar/free.ics');
  assert.equal(result.opportunities.length,2);
 });
 it('reports source failure instead of inventing success',async()=>{
  await assert.rejects(
   ()=>scanPhotoOpportunities({genre:'any',freeOnly:false},
    (async()=>new Response('down',{status:503})) as typeof fetch,clock),
   /unavailable/
  );
 });
});
