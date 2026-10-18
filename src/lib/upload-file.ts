import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_FOLDERS = ['uploads','artikel','testimoni','alumni','guru','e-voting','ekskul','galeri','downloads','fasilitas','prestasi','mitra','jurusan','pengumuman'];
export type AssetKind = 'photo' | 'logo' | 'document';
export class UploadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function prepareUpload(file: File, assetKind?: AssetKind) {
  if (!(file instanceof File) || !file.size) throw new UploadError(400, 'Pilih file yang tidak kosong.');
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(413, 'Ukuran file maksimal 5 MiB.');
  if (assetKind !== undefined && !['photo','logo','document'].includes(assetKind)) throw new UploadError(400, 'Jenis aset tidak valid.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const png = buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const jpeg = buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex'));
  const webp = buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
  const image = png || jpeg || webp;
  const purpose = assetKind ?? (image ? 'photo' : 'document');
  if (purpose === 'document') {
    const ole = buffer.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
    const zip = buffer.subarray(0,4).equals(Buffer.from('504b0304','hex')) || buffer.subarray(0,4).equals(Buffer.from('504b0506','hex'));
    // shortcut: Office checks validate container signatures; add structural parsing before introducing document ingestion.
    const documents: Record<string, [boolean,string]> = {
      pdf:[buffer.toString('ascii',0,5)==='%PDF-','application/pdf'],
      doc:[ole,'application/msword'],xls:[ole,'application/vnd.ms-excel'],ppt:[ole,'application/vnd.ms-powerpoint'],
      docx:[zip,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      xlsx:[zip,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      pptx:[zip,'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      zip:[zip,'application/zip'],rar:[buffer.subarray(0,7).equals(Buffer.from('526172211a0700','hex')) || buffer.subarray(0,8).equals(Buffer.from('526172211a070100','hex')),'application/vnd.rar'],
    };
    if (!documents[ext]?.[0] || image) throw new UploadError(415, 'Format dokumen tidak didukung atau isi file tidak sesuai.');
    return { buffer, mimeType: documents[ext][1], size: buffer.length, kind: 'file' as const, extension: ext };
  }
  if (!image || !['jpg','jpeg','png','webp'].includes(ext)) throw new UploadError(415, 'Gunakan foto JPG, PNG, atau WebP statis. SVG dan animasi tidak didukung.');
  if (png) {
    for (let offset=8; offset+12<=buffer.length;) {
      const length=buffer.readUInt32BE(offset);
      if (buffer.toString('ascii',offset+4,offset+8)==='acTL') throw new UploadError(415, 'Gambar animasi tidak didukung.');
      offset+=length+12;
    }
  }
  try {
    const input=sharp(buffer,{limitInputPixels:40_000_000,failOn:'warning'});
    const meta=await input.metadata();
    if ((meta.pages ?? 1)>1) throw new UploadError(415, 'Gambar animasi tidak didukung.');
    if (!meta.width || !meta.height || meta.width*meta.height>40_000_000) throw new UploadError(422, 'Dimensi gambar maksimal 40 juta piksel.');
    const output=await input.autoOrient().resize(1800,1800,{fit:'inside',withoutEnlargement:true})
      .webp(purpose==='logo'?{lossless:true,exact:true,effort:4}:{quality:85,effort:4}).toBuffer();
    return { buffer:output, mimeType:'image/webp', size:output.length, kind:'image' as const, extension:'webp' };
  } catch(error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError(422, 'Gambar rusak atau melebihi batas 40 juta piksel.');
  }
}
