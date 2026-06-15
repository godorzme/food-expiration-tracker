// src/lib/auth/cookie.ts
// HMAC-SHA256 signed token "<userId>.<sig>". Uses Web Crypto + btoa/atob so it
// runs in both the edge middleware runtime and node route handlers.
function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const encoder = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(payload: string): Promise<string> {
  const key = await importKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toB64Url(new Uint8Array(sig));
}

export async function signSession(userId: string): Promise<string> {
  const sig = await hmac(userId);
  return `${userId}.${sig}`;
}

export async function verifySession(token: string): Promise<string | null> {
  if (!token || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!userId) return null;
  const expected = await hmac(userId);
  // constant-time-ish compare
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? userId : null;
}
