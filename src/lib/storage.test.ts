import { describe, it, expect, afterEach } from "vitest";
import { getPhotoUrl } from "./storage";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

describe("getPhotoUrl", () => {
  it("signs against S3_PUBLIC_ENDPOINT when set", async () => {
    process.env.S3_PUBLIC_ENDPOINT = "https://photos.example.com";
    process.env.S3_ENDPOINT = "http://minio.internal:9000";
    process.env.S3_ACCESS_KEY = "k";
    process.env.S3_SECRET_KEY = "s";
    process.env.S3_BUCKET = "zeabur";
    process.env.S3_FORCE_PATH_STYLE = "true";
    const url = await getPhotoUrl("hh1/abc.jpg");
    expect(url.startsWith("https://photos.example.com")).toBe(true);
    expect(url).toContain("zeabur");
    expect(url).toContain("X-Amz-Signature");
  });

  it("falls back to S3_ENDPOINT when no public endpoint set", async () => {
    delete process.env.S3_PUBLIC_ENDPOINT;
    process.env.S3_ENDPOINT = "http://minio.internal:9000";
    process.env.S3_ACCESS_KEY = "k";
    process.env.S3_SECRET_KEY = "s";
    process.env.S3_BUCKET = "zeabur";
    process.env.S3_FORCE_PATH_STYLE = "true";
    const url = await getPhotoUrl("abc.jpg");
    expect(url).toContain("minio.internal:9000");
  });
});
