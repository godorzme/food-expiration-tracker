import exifr from "exifr";

type ParseFn = (input: Uint8Array) => Promise<{ DateTimeOriginal?: Date } | null>;

export async function resolveCapturedAt(
  bytes: Uint8Array,
  uploadTime: Date,
  parse: ParseFn = (b) =>
    (exifr.parse(b, ["DateTimeOriginal"]) as Promise<{ DateTimeOriginal?: Date } | null>),
): Promise<Date> {
  try {
    const data = await parse(bytes);
    const dto = data?.DateTimeOriginal;
    if (dto instanceof Date && !Number.isNaN(dto.getTime())) return dto;
  } catch {
    // fall through to upload time
  }
  return uploadTime;
}
