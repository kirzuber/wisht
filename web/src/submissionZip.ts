/** Zero-dependency, STORE-method ZIP for already-compressed WebP previews.
 * Deliberately bounded to eight images; no external encoder service.
 */
export type ZipEntry={name:string;bytes:Uint8Array};
function crc32(input:Uint8Array):number{
 let crc=0xffffffff;
 for(const byte of input){
  crc^=byte;
  for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
export function buildZip(entries:ZipEntry[]):Blob{
 if(!entries.length||entries.length>12)throw new Error('Invalid submission package size.');
 const encoder=new TextEncoder();
 const local:Uint8Array[]=[];const central:Uint8Array[]=[];
 let offset=0;
 for(const file of entries){
  if(!file.name||file.name.includes('/')||file.name.includes('\\')||file.name==='.'||file.name==='..'){
   throw new Error('Invalid ZIP filename.');
  }
  if(file.bytes.length>8*1024*1024)throw new Error('One preview is too large for this package.');
  const label=encoder.encode(file.name);
  if(label.length>220)throw new Error('A ZIP filename is too long.');
  const crc=crc32(file.bytes),size=file.bytes.byteLength;
  const h=new Uint8Array(30+label.length);
  const v=new DataView(h.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);
  v.setUint16(8,0,true);v.setUint32(14,crc,true);
  v.setUint32(18,size,true);v.setUint32(22,size,true);v.setUint16(26,label.length,true);
  h.set(label,30);local.push(h,file.bytes);
  const ch=new Uint8Array(46+label.length),cv=new DataView(ch.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
  cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,size,true);cv.setUint32(24,size,true);
  cv.setUint16(28,label.length,true);cv.setUint32(42,offset,true);
  ch.set(label,46);central.push(ch);
  offset+=h.length+size;
 }
 const cdLen=central.reduce((n,c)=>n+c.length,0);
 const end=new Uint8Array(22),ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);
 ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
 ev.setUint32(12,cdLen,true);ev.setUint32(16,offset,true);
 // Copy into fresh buffers for BlobPart generic compatibility.
 const chunks:BlobPart[]=[...local,...central,end].map(x=>Uint8Array.from(x).buffer);
 return new Blob(chunks,{type:'application/zip'});
}
