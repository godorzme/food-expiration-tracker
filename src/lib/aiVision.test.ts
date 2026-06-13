import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recognizeFood } from "./aiVision";

describe("recognizeFood (fail-safe)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns [] and does not call fetch when config is missing", async () => {
    vi.stubEnv("AI_HUB_BASE_URL", "");
    vi.stubEnv("AI_HUB_API_KEY", "");
    vi.stubEnv("AI_HUB_VISION_MODEL", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await recognizeFood(new Uint8Array([1, 2, 3]), "image/jpeg");
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses recognized items from a successful response", async () => {
    vi.stubEnv("AI_HUB_BASE_URL", "https://ai.example.com/v1/");
    vi.stubEnv("AI_HUB_API_KEY", "k");
    vi.stubEnv("AI_HUB_VISION_MODEL", "vision");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"items":[{"name":"雞蛋","category":"蛋","confidence":0.8}]}' } }],
        }),
      })),
    );
    const result = await recognizeFood(new Uint8Array([1]), "image/jpeg");
    expect(result).toEqual([{ name: "雞蛋", category: "蛋", confidence: 0.8 }]);
  });

  it("returns [] on a non-ok response", async () => {
    vi.stubEnv("AI_HUB_BASE_URL", "https://ai.example.com");
    vi.stubEnv("AI_HUB_API_KEY", "k");
    vi.stubEnv("AI_HUB_VISION_MODEL", "vision");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await recognizeFood(new Uint8Array([1]), "image/jpeg")).toEqual([]);
  });

  it("returns [] when fetch throws (network/timeout)", async () => {
    vi.stubEnv("AI_HUB_BASE_URL", "https://ai.example.com");
    vi.stubEnv("AI_HUB_API_KEY", "k");
    vi.stubEnv("AI_HUB_VISION_MODEL", "vision");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    expect(await recognizeFood(new Uint8Array([1]), "image/jpeg")).toEqual([]);
  });
});
