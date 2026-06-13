import { describe, it, expect, vi } from "vitest";
import { resolveCapturedAt } from "./exif";

describe("resolveCapturedAt", () => {
  it("uses EXIF DateTimeOriginal when present", async () => {
    const exif = { DateTimeOriginal: new Date("2026-06-10T08:30:00Z") };
    const parse = vi.fn(async () => exif);
    const fallback = new Date("2026-06-13T00:00:00Z");
    const result = await resolveCapturedAt(new Uint8Array(), fallback, parse as any);
    expect(result.toISOString()).toBe("2026-06-10T08:30:00.000Z");
  });

  it("falls back to upload time when EXIF missing", async () => {
    const parse = vi.fn(async () => null);
    const fallback = new Date("2026-06-13T00:00:00Z");
    const result = await resolveCapturedAt(new Uint8Array(), fallback, parse as any);
    expect(result.toISOString()).toBe(fallback.toISOString());
  });

  it("falls back when parser throws", async () => {
    const parse = vi.fn(async () => { throw new Error("bad"); });
    const fallback = new Date("2026-06-13T00:00:00Z");
    const result = await resolveCapturedAt(new Uint8Array(), fallback, parse as any);
    expect(result.toISOString()).toBe(fallback.toISOString());
  });
});
