import { db } from './prisma';
import { uploadToR2 } from './r2';
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, UploadError, type AssetKind } from './upload-file';

export const uploadJson = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});

export async function receiveUpload(request: Request, alumni=false) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return uploadJson({error:'Permintaan upload harus berasal dari situs ini.'},403);
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get('content-type')??'')) return uploadJson({error:'Gunakan formulir upload multipart.'},415);
  try {
    const limit=MAX_UPLOAD_BYTES+64*1024;
    if (Number(request.headers.get('content-length'))>limit) throw new UploadError(413,'Ukuran file maksimal 5 MiB.');
    const reader=request.body?.getReader();
    if (!reader) throw new UploadError(400,'Pilih file yang tidak kosong.');
    const chunks:Uint8Array[]=[];let length=0;
    try { for (;;) { const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new UploadError(413,'Ukuran file maksimal 5 MiB.');}chunks.push(value); } }
    finally { reader.releaseLock(); }
    let data:FormData;
    try { data=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')!}}).formData(); }
    catch { throw new UploadError(400,'Formulir upload tidak valid.'); }
    const allowed=alumni?['file']:['file','folder','assetKind'];
    for(const key of data.keys())if(!allowed.includes(key)||data.getAll(key).length!==1)throw new UploadError(400,'Field upload tidak valid.');
    const file=data.get('file');if(!(file instanceof File)||!file.size)throw new UploadError(400,'Pilih file yang tidak kosong.');
    const folder=alumni?'alumni':data.get('folder')??'uploads';
    const assetKind=alumni?'photo':data.get('assetKind')??undefined;
    if(typeof folder!=='string'||!UPLOAD_FOLDERS.includes(folder)||assetKind!==undefined&&(typeof assetKind!=='string'||!['photo','logo','document'].includes(assetKind)))throw new UploadError(400,'Folder atau jenis aset tidak valid.');
    const stored=await uploadToR2(file,folder,assetKind as AssetKind|undefined);
    let media=null;
    try { media=await db.media.create({data:{...stored,filename:file.name,folder}}); }
    catch { console.error(alumni?'Alumni upload media indexing failed':'Admin upload media indexing failed'); }
    return uploadJson({...stored,...(alumni?{}:{id:media?.id??null}),...(!media?{warning:'File tersimpan, tetapi belum tercatat di pustaka media. Simpan URL ini; jangan upload ulang otomatis.'}:{})});
  } catch(error) {
    if(error instanceof UploadError)return uploadJson({error:error.message},error.status);
    console.error(alumni?'Alumni upload storage failed':'Admin upload storage failed');
    return uploadJson({error:'Upload belum berhasil. Coba kembali beberapa saat.'},503);
  }
}
