import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {proposedCoverNote,packageMarkdown,safeFilePart,selectedPhotoManifest} from '../../web/src/submissionModel.ts';
import {buildZip} from '../../web/src/submissionZip.ts';
describe('Honest submission preparation',()=>{
 it('builds a factual draft without inventing artist credentials',()=>{
  const note=proposedCoverNote({opportunityTitle:'Art Call',portfolioTitle:'My gallery',introduction:'I photograph lakes.',artistName:'A'});
  assert.match(note,/I photograph lakes/);
  assert.doesNotMatch(note,/award-winning|published in|exhibition history/i);
 });
 it('marks unreviewed rules and WebP limitations prominently',()=>{
  const content=packageMarkdown({opportunityTitle:'Art Call',deadline:'2026-12-30',listingUrl:'https://pixcontests.com/art-call',
   organizerUrl:'',rulesNotes:'',reviewedByUser:false,artistName:'',artistStatement:'',coverNote:'A draft',
   photoNames:['photo.webp'],portfolioTitle:'My gallery'});
  assert.match(content,/NOT CONFIRMED/);
  assert.match(content,/NOT SUBMITTED/);
  assert.match(content,/WebP preview/);
 });
 it('selects only user-selected portfolio photos',()=>{
  const photos=[{id:'a',path:'a.webp',name:'a.jpg',selected:true},{id:'b',path:'b.webp',name:'b.jpg',selected:false}];
  assert.deepEqual(selectedPhotoManifest(photos as never).map(x=>x.id),['a']);
 });
 it('creates a well-formed, zero-dependency ZIP envelope',async()=>{
  const out=buildZip([{name:'README.md',bytes:new TextEncoder().encode('Hello')},{name:'image.webp',bytes:Uint8Array.from([1,2,3])}]);
  const data=new DataView(await out.arrayBuffer());
  assert.equal(data.getUint32(0,true),0x04034b50);
  assert.equal(data.getUint32(data.byteLength-22,true),0x06054b50);
  assert.equal(data.getUint16(data.byteLength-14,true),2);
  assert.throws(()=>buildZip([{name:'../secret',bytes:new Uint8Array()}]));
 });
 it('sanitizes arbitrary original filenames',()=>{
  assert.equal(safeFilePart('../../private photo?.jpg'),'private-photo-jpg');
 });
});
