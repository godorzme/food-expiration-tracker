import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send: sendMock }; }),
  PutObjectCommand: vi.fn(function (x: unknown) { return x; }),
  GetObjectCommand: vi.fn(function (x: unknown) { return x; }),
}));

import { getPhotoBytes } from "./storage";

describe("getPhotoBytes", () => {
  it("returns body bytes + content type from the object", async () => {
    sendMock.mockResolvedValueOnce({
      ContentType: "image/png",
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    const res = await getPhotoBytes("k.png");
    expect(res.contentType).toBe("image/png");
    expect(Array.from(res.body)).toEqual([1, 2, 3]);
  });

  it("defaults content type to image/jpeg when missing", async () => {
    sendMock.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([9]) },
    });
    const res = await getPhotoBytes("k");
    expect(res.contentType).toBe("image/jpeg");
  });
});
