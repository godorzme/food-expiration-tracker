import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible storage. Prefer a configurable endpoint (Zeabur Object Storage /
// MinIO / any S3 service); fall back to Cloudflare R2's account-scoped endpoint
// when S3_ENDPOINT isn't set, so either backend works with no code change.
const endpoint =
  process.env.S3_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint,
  // MinIO/RustFS require path-style addressing; R2 works either way.
  // Default: on when using a custom S3_ENDPOINT, off for R2. Override with S3_FORCE_PATH_STYLE.
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE
    ? process.env.S3_FORCE_PATH_STYLE === "true"
    : !!process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET || process.env.R2_BUCKET!;

export async function putPhoto(key: string, bytes: Uint8Array, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentType }));
  return key;
}

export async function getPhotoUrl(key: string, expiresInSec = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSec });
}
