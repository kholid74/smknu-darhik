import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { prepareUpload, UPLOAD_FOLDERS, UploadError, type AssetKind } from './upload-file';
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

export async function uploadToR2(file: File, folder = 'uploads', assetKind?: AssetKind) {
  if (!UPLOAD_FOLDERS.includes(folder)) throw new UploadError(400, 'Folder upload tidak valid.');
  const { buffer, mimeType, size, kind, extension } = await prepareUpload(file, assetKind);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `${folder}/${date}-${randomUUID()}.${extension}`;
  await r2Client().send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ...(kind === 'file' ? { ContentDisposition: 'attachment' } : {}),
    ACL: 'public-read',
  }));
  return { url:`${PUBLIC_URL().replace(/\/$/,'')}/${key}`, mimeType, size, kind };
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
