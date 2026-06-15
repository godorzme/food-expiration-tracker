import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// All config is read at call time (not module load) so the upload path and the
// presign path can target different endpoints, and so tests can vary env.

export function bucket(): string {
  return process.env.S3_BUCKET || process.env.R2_BUCKET || "";
}

export function r2Endpoint(): string | undefined {
  return process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined;
}

export function makeClient(endpoint: string | undefined): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint,
    // MinIO/RustFS need path-style; default on when any S3 endpoint is configured.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE
      ? process.env.S3_FORCE_PATH_STYLE === "true"
      : !!(process.env.S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}

// Server→storage uploads use the internal endpoint (fast, no egress charge).
export function uploadClient(): S3Client {
  return makeClient(process.env.S3_ENDPOINT || r2Endpoint());
}

export async function putPhoto(key: string, bytes: Uint8Array, contentType: string) {
  await uploadClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: contentType }),
  );
  return key;
}

export async function getPhotoBytes(key: string): Promise<{ body: Uint8Array; contentType: string }> {
  const res = await uploadClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const body = await (res.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  return { body, contentType: res.ContentType || "image/jpeg" };
}
