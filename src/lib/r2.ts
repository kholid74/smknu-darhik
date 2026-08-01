import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env, requireEnv } from './env';

// Built on first use, not at import time: pages that never touch R2 should not
// fail to render just because the R2 credentials are absent.
let client: S3Client | null = null;
function r2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: requireEnv('R2_ENDPOINT'),
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY'),
        secretAccessKey: requireEnv('R2_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
  }
  return client;
}

const BUCKET = () => env('R2_BUCKET') || 'smknu-darulhikam-assets';
const PUBLIC_URL = () => env('R2_PUBLIC_URL') || '/api/image';

export async function uploadToR2(file: File, folder = 'uploads'): Promise<string> {
  const origExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Compress with Sharp: max 1800px, 85% quality.
  // Gambar beralpha (logo PNG transparan) -> WebP agar transparansi terjaga; selain itu JPEG.
  let finalBuffer = buffer;
  let contentType = file.type || 'application/octet-stream';
  let ext = origExt;
  try {
    const meta = await sharp(buffer).metadata();
    const pipeline = sharp(buffer).resize(1800, 1800, { fit: 'inside', withoutEnlargement: true });
    if (meta.hasAlpha) {
      finalBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
    } else {
      finalBuffer = await pipeline.jpeg({ quality: 85, progressive: true }).toBuffer();
      contentType = 'image/jpeg';
      ext = 'jpg';
    }
    console.log(`[R2] Compressed: ${(buffer.length / 1024).toFixed(0)}KB → ${(finalBuffer.length / 1024).toFixed(0)}KB (${ext})`);
  } catch {
    // If sharp fails (e.g., non-image file), use original bytes/ext/type
  }
  const key = `${folder}/${date}-${random}.${ext}`;
  await r2Client().send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: finalBuffer,
    ContentType: contentType,
    ACL: 'public-read',
  }));
  return `${PUBLIC_URL()}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
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
    const obj = await r2Client().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
    const bytes = await obj.Body?.transformToByteArray();
    if (!bytes) return null;
    return { bytes, contentType: obj.ContentType || 'application/octet-stream' };
  } catch {
    return null;
  }
}
