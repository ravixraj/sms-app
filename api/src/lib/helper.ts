import { sign } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";

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

  return sign({ ...payload, iat: now, exp: now + seconds }, secret);
};
