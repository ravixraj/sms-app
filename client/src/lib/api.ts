import { hc } from "hono/client";
import type { AppType } from "../../../api/src/index";
import {
  useAuthStore,
  type AuthSession,
  type AuthUser,
} from "@/stores/auth-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

export type ApiResult<T> =
  | { success: true; message: string; data: T }
  | { success: false; message: string; data: null; status: number };

type ResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

/** Parses the API envelope and returns a discriminated result. */
export async function parseApiResponse<T>(
  response: ResponseLike,
): Promise<ApiResult<T>> {
  const payload = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success || payload.data === null) {
    return {
      success: false,
      message: payload?.message ?? "Something went wrong. Please try again.",
      data: null,
      status: response.status,
    };
  }

  return { success: true, message: payload.message, data: payload.data };
}

export const client = hc<AppType>(API_BASE_URL);

let refreshing: Promise<AuthSession | null> | null = null;

/**
 * Rotates the token pair. Concurrent 401s share one request so the
 * refresh token is never rotated twice.
 */
export function refreshSession(): Promise<AuthSession | null> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const { refreshToken } = useAuthStore.getState();

    if (!refreshToken) {
      useAuthStore.getState().clearSession();
      return null;
    }

    try {
      const response = await client.api.v1.auth.refresh.$post({
        json: { refreshToken },
      });
      const result = await parseApiResponse<AuthSession>(response);

      if (!result.success) {
        if (result.status === 401) {
          useAuthStore.getState().clearSession();
        }
        return null;
      }

      useAuthStore.getState().setSession(result.data);
      return result.data;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

const authFetch: typeof fetch = async (input, init) => {
  const send = () => {
    const headers = new Headers(init?.headers);
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return fetch(input, { ...init, headers });
  };

  const response = await send();
  if (response.status !== 401) return response;

  return (await refreshSession()) ? send() : response;
};

export const authClient = hc<AppType>(API_BASE_URL, { fetch: authFetch });

/** Validates a persisted session and reloads the current user. */
export async function restoreSession(): Promise<void> {
  const { accessToken, refreshToken } = useAuthStore.getState();
  if (!accessToken && !refreshToken) return;

  try {
    const response = await authClient.api.v1.users.me.$get();
    const result = await parseApiResponse<{ user: AuthUser }>(response);

    if (result.success) {
      useAuthStore.getState().setUser(result.data.user);
      return;
    }

    // The account no longer exists, or the session was rejected.
    if (result.status === 401 || result.status === 404) {
      useAuthStore.getState().clearSession();
    }
  } catch {
    // Keep tokens on network errors so the session can recover later.
  }
}

/** Revokes the refresh token server-side, then clears the local session. */
export async function logout(): Promise<void> {
  try {
    await authClient.api.v1.auth.logout.$post();
  } catch {
    // Local sign-out still succeeds without network access.
  }

  useAuthStore.getState().clearSession();
}
