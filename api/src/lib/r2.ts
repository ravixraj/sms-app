import type { AppBindings } from "#app-env";
import { HTTP, HttpStatus } from "./http";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ALLOWED_IMAGE_TYPES = Object.keys(EXTENSION_BY_TYPE);

type R2Bucket = AppBindings["USER_AVATARS"];

export const deleteAvatar = async (bucket: R2Bucket, key: string) => {
  try {
    await bucket.delete(key);
  } catch (error) {
    // Cleanup failures must not fail the request that already succeeded.
    console.error(`Failed to delete avatar "${key}"`, error);
  }
};

export const uploadAvatar = async (bucket: R2Bucket, file: File) => {
  const extension = EXTENSION_BY_TYPE[file.type];

  if (!extension) {
    throw HTTP.Error(
      HttpStatus.BAD_REQUEST,
      `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    );
  }

  const key = `avatars/${crypto.randomUUID()}.${extension}`;

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return { key };
};
