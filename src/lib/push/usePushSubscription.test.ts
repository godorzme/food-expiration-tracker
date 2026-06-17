import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./usePushSubscription";

describe("urlBase64ToUint8Array", () => {
  it("decodes standard base64 to bytes", () => {
    const out = urlBase64ToUint8Array("AAAA");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual([0, 0, 0]);
  });
  it("handles base64url chars (- _) and missing padding", () => {
    // "-_-_" → "+/+/" → 3 bytes
    expect(urlBase64ToUint8Array("-_-_").length).toBe(3);
  });
  it("decodes a 65-byte P-256 VAPID public key", () => {
    const key = "BOXN0k7NX2cSeg07jE_gnooAHSUJAaIPUjjalsOb5KrkR_OpekmfccpGiQDoPRM3YnmWC94Hb3SbZLAI031xWrs";
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});
