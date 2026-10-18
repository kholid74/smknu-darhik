import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareUpload,MAX_UPLOAD_BYTES} from './upload-file';
const file=(bytes:Uint8Array,name='photo.png',type='image/png')=>new File([bytes],name,{type});

test('static photo bytes determine WebP output, dimensions and metadata, ignoring client MIME',async()=>{
  const input=await sharp({create:{width:2200,height:1100,channels:3,background:'#b28a65'}}).jpeg().toBuffer();
  const result=await prepareUpload(file(input,'school.jpg','text/html'));
  assert.equal(result.mimeType,'image/webp');assert.equal(result.extension,'webp');assert.equal(result.kind,'image');assert.equal(result.size,result.buffer.length);
  const meta=await sharp(result.buffer).metadata();assert.equal(meta.width,1800);assert.equal(meta.height,900);assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);
});
test('EXIF orientation is applied before resizing and metadata is removed without enlarging',async()=>{
  const input=await sharp({create:{width:80,height:40,channels:3,background:'#237a52'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const result=await prepareUpload(file(input,'rotated.jpg'));
  const meta=await sharp(result.buffer).metadata();assert.equal(meta.width,40);assert.equal(meta.height,80);assert.equal(meta.orientation,undefined);assert.equal(meta.exif,undefined);
});
test('logo lossless preserves pixel colour and alpha; alpha photos still use the photo policy',async()=>{
  const pixels=Buffer.from([255,0,0,0,0,255,0,128,0,0,255,255,20,80,30,255]);
  const input=await sharp(pixels,{raw:{width:2,height:2,channels:4}}).png().toBuffer();
  const logo=await prepareUpload(file(input),'logo');assert.deepEqual(await sharp(logo.buffer).raw().toBuffer(),pixels);
  const photo=await prepareUpload(file(input),'photo');assert.equal((await sharp(photo.buffer).metadata()).hasAlpha,true);
});
test('approved document containers retain identical bytes and actual MIME while executable disguises fail',async()=>{
  const examples=[['document.pdf','%PDF-1.7\nfixture\n%%EOF','application/pdf'],['sheet.xlsx','504b030400000000','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],['old.xls','d0cf11e0a1b11ae100000000','application/vnd.ms-excel'],['archive.zip','504b050600000000','application/zip']];
  for(const [name,data,type]of examples){const bytes=Buffer.from(data,name.endsWith('.pdf')?'utf8':'hex');const result=await prepareUpload(file(bytes,name,'image/png'));assert.equal(result.kind,'file');assert.equal(result.mimeType,type);assert.deepEqual(result.buffer,bytes);}
  await assert.rejects(prepareUpload(file(Buffer.from('<html>evil</html>'),'fake.pdf','application/pdf')),{status:415});
  await assert.rejects(prepareUpload(file(Buffer.from('MZexecutable'),'file.exe')),{status:415});
});
test('empty, over-limit and corrupt rasters are rejected before storage; pixel limit is enforced',async()=>{
  await assert.rejects(prepareUpload(file(new Uint8Array())),{status:400});
  await assert.rejects(prepareUpload(file(new Uint8Array(MAX_UPLOAD_BYTES+1))),{status:413});
  await assert.rejects(prepareUpload(file(Buffer.from('ffd8ff0000','hex'),'broken.jpg')),{status:422});
  const huge=await sharp({create:{width:8000,height:5001,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(prepareUpload(file(huge)),{status:422});
});
test('SVG, GIF, APNG, animated WebP and incompatible purposes do not silently flatten or bypass policy',async()=>{
  await assert.rejects(prepareUpload(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),'logo.svg')),{status:415});
  await assert.rejects(prepareUpload(file(Buffer.from('GIF89a'),'photo.gif')),{status:415});
  const animation=await sharp(Buffer.concat([Buffer.alloc(12,255),Buffer.alloc(12,0)]),{raw:{width:2,height:4,channels:3,pageHeight:2}}).webp({loop:0,delay:[100,100]}).toBuffer();
  assert.equal((await sharp(animation).metadata()).pages,2);
  await assert.rejects(prepareUpload(file(animation,'motion.webp')),{status:415});
  const png=await sharp({create:{width:1,height:1,channels:3,background:'red'}}).png().toBuffer();
  const actl=Buffer.concat([png.subarray(0,8),Buffer.from('000000086163544c000000020000000000000000','hex'),png.subarray(8)]);
  await assert.rejects(prepareUpload(file(actl)),{status:415});
  await assert.rejects(prepareUpload(file(png),'document'),{status:415});
  await assert.rejects(prepareUpload(file(Buffer.from('%PDF-1.7'),'file.pdf'),'photo'),{status:415});
});
