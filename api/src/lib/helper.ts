import { HTTPStatus } from "#const";
import type { AuthEnv } from "#middleware/auth";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import type { CookieOptions } from "hono/utils/cookie";
import type { JWTPayload } from "hono/utils/jwt/types";

// Cookie management
const cookieOptions = (c: Context<AuthEnv>): CookieOptions => ({
  httpOnly: true,
  secure: new URL(c.req.url).protocol === "https:",
  sameSite: "Lax",
  path: "/",
});

export const setSessionCookies = (
  c: Context<AuthEnv>,
  session: { accessToken: string; refreshToken: string },
) => {
  const options = cookieOptions(c);
  setCookie(c, "accessToken", session.accessToken, {
    ...options,
    maxAge: Number(c.env.ACCESS_TOKEN_EXPIRY),
  });
  setCookie(c, "refreshToken", session.refreshToken, {
    ...options,
    maxAge: Number(c.env.REFRESH_TOKEN_EXPIRY),
  });
};

export const clearSessionCookies = (c: Context<AuthEnv>) => {
  const options = cookieOptions(c);
  deleteCookie(c, "accessToken", options);
  deleteCookie(c, "refreshToken", options);
};

// Password hashing and verification
const ITERATIONS = 100_000;
const KEY_LENGTH = 256;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }

  return diff === 0;
};

const deriveBits = async (
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    KEY_LENGTH,
  );

  return new Uint8Array(bits);
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt);

  return `${bytesToBase64(salt)}:${bytesToBase64(hash)}`;
};

export const passwordMatch = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const parts = stored.split(":");

  if (parts.length !== 2) {
    return false;
  }

  try {
    const salt = base64ToBytes(parts[0]!);
    const expected = base64ToBytes(parts[1]!);
    const actual = await deriveBits(password, salt);

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};

// JWT signing
export const signToken = (
  payload: JWTPayload,
  secret: string,
  expiry: string | number,
) => {
  const seconds = Number(expiry);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid token expiry: ${expiry}`);
  }

  const now = Math.floor(Date.now() / 1000);

  return sign(
    { ...payload, jti: crypto.randomUUID(), iat: now, exp: now + seconds },
    secret,
  );
};

// R2 Validates and uploads a WebP avatar; returns the R2 key and its public URL.
export const uploadAvatar = async (c: Context<AuthEnv>, file: File) => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!isWebp) {
    throw new HTTPException(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {
      message: "Invalid WebP file",
    });
  }
  const key = `avatars/${crypto.randomUUID()}.webp`;
  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return {
    key,
    url: `${c.env.AVATAR_PUBLIC_URL.replace(/\/$/, "")}/${key}`,
  };
};
