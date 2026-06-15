import { describe, it, expect, vi, afterEach } from "vitest";
import { pushLine } from "./linePush";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("pushLine", () => {
  it("returns false and does not fetch when token missing", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await pushLine("U1", "hi")).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("returns true on ok response", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
    expect(await pushLine("U1", "hi")).toBe(true);
  });
  it("returns false when fetch throws", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("x"); }));
    expect(await pushLine("U1", "hi")).toBe(false);
  });
  it("returns false for null lineUserId without fetching", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "tok");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await pushLine(null, "x")).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
