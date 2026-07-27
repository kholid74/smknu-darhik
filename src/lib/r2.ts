import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || 'https://b6cd21e5b0f983939dc63abc8a90dbcc.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || 'f654312b8a037a2315c375ca646e1fce',
    secretAccessKey: process.env.R2_SECRET_KEY || 'c9c96fd2232675d5500856b5eec9c95fb30cb6f31b62fb6f82b6fa52d2558ee4',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET || 'smknu-darulhikam-assets';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '/api/image';

export async function uploadToR2(file: File, folder = 'uploads'): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  const key = `${folder}/${date}-${random}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Compress with Sharp: max 1800px wide, 85% quality
  let finalBuffer = buffer;
  let contentType = file.type || 'image/png';
  try {
    const compressed = await sharp(buffer)
      .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    finalBuffer = compressed;
    contentType = 'image/jpeg';
    console.log(`[R2] Compressed: ${(buffer.length/1024).toFixed(0)}KB → ${(compressed.length/1024).toFixed(0)}KB`);
  } catch {
    // If sharp fails (e.g., non-image file), use original
  }
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: finalBuffer,
    ContentType: contentType,
    ACL: 'public-read',
  }));
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Extract key from public URL
export function keyFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.substring(1);
    return path || null;
  } catch { return null; }
}

export async function getFileFromR2(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = await obj.Body?.transformToByteArray();
    if (!bytes) return null;
    return { bytes, contentType: obj.ContentType || 'application/octet-stream' };
  } catch {
    return null;
  }
}
