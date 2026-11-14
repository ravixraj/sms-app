import { HTTP, HttpStatus } from "./http";

type Bucket = Env["USER_AVATARS"];

export const deleteAvatar = async (
  bucket: Bucket,
  keyOrUrl: string,
  publicUrl: string,
) => {
  const prefix = `${publicUrl.replace(/\/$/, "")}/`;
  const key = keyOrUrl.startsWith(prefix)
    ? keyOrUrl.slice(prefix.length)
    : keyOrUrl;
  if (!/^avatars\/[\da-f-]+\.(jpg|webp)$/.test(key)) return;
  try {
    await bucket.delete(key);
  } catch {
    console.error({ message: "Avatar cleanup failed", key });
  }
};

export const uploadAvatar = async (
  bucket: Bucket,
  file: File,
  publicUrl: string,
) => {
  if (!publicUrl.startsWith("https://")) {
    throw HTTP.error(
      HttpStatus.SERVICE_UNAVAILABLE,
      "Avatar hosting is not configured",
    );
  }
  if (file.size === 0 || file.size > 100 * 1024) {
    throw HTTP.error(
      HttpStatus.BAD_REQUEST,
      "Avatar must be between 1 byte and 100 KB",
    );
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !webp)
    throw HTTP.error(HttpStatus.BAD_REQUEST, "Upload a JPEG or WebP image");
  const key = `avatars/${crypto.randomUUID()}.${jpeg ? "jpg" : "webp"}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: jpeg ? "image/jpeg" : "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return { key, url: `${publicUrl.replace(/\/$/, "")}/${key}` };
};
