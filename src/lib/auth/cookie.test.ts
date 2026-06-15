import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession } from "./cookie";

beforeAll(() => { process.env.SESSION_SECRET = "test-secret-please-change"; });

describe("session cookie", () => {
  it("round-trips a userId", async () => {
    const token = await signSession("user_123");
    expect(token).toContain(".");
    expect(await verifySession(token)).toBe("user_123");
  });
  it("rejects a tampered token", async () => {
    const token = await signSession("user_123");
    const tampered = token.replace("user_123", "user_999");
    expect(await verifySession(tampered)).toBeNull();
  });
  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });
});
