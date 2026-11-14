import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { publicPath, publicGalleryPath, selectedForPublication, MAX_PUBLISHED_PHOTOS } from '../../web/src/portfolioPublicationModel.ts';

describe('Public portfolio snapshot', () => {
  it('uses a stable owner/portfolio/photo storage path',()=>{
    assert.equal(publicPath('owner','portfolio','photo'),'owner/portfolio/photo.webp');
  });
  it('constructs a shareable URL only for correctly shaped slugs',()=>{
    assert.equal(publicGalleryPath('abcdef0123456789'),'/p/abcdef0123456789');
    assert.throws(()=>publicGalleryPath('../private'));
  });
  it('uses exactly the selected photos without silently truncating',()=>{
    const photos=Array.from({length:12},(_,i)=>({
      id:String(i),selected:i%2===0,path:`p/${i}`,score:40,name:'test',width:100,height:100,hash:'a'
    }));
    assert.equal(MAX_PUBLISHED_PHOTOS,8);
    assert.deepEqual(selectedForPublication(photos).map(x=>x.id),['0','2','4','6','8','10']);
  });
});
