import { describe, it, expect, vi, afterEach } from "vitest";
import { pushWeb } from "./webPush";

afterEach(() => { vi.unstubAllEnvs(); });

describe("pushWeb (fail-safe guard)", () => {
  it("returns false when VAPID_PRIVATE_KEY is missing", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_SUBJECT", "mailto:a@b.c");
    expect(await pushWeb("u1", { title: "t", body: "b" })).toBe(false);
  });

  it("returns false when VAPID_SUBJECT is missing (would otherwise throw in setVapidDetails)", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_SUBJECT", "");
    expect(await pushWeb("u1", { title: "t", body: "b" })).toBe(false);
  });
});
