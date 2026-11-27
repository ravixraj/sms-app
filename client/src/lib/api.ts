import { hc, type InferResponseType } from "hono/client";
import { API_URL } from "$app/env/public";
import type { AppType } from "../../../api/src/index";

// In development, use Vite's same-origin /api proxy to avoid local CORS.
const baseUrl = import.meta.env.DEV ? "" : API_URL;

// Refresh rotates (and invalidates) the refresh token, so every request that
// gets a 401 while a refresh is already running must share the same call.
let pendingRefresh: Promise<boolean> | null = null;

const refreshSession = (): Promise<boolean> => {
  pendingRefresh ??= (async () => {
    try {
      // Goes through the typed client; the guard below stops the wrapper from
      // trying to refresh the refresh request itself.
      const response = await client.api.auth.refresh.$post();
      return response.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
};

// Login failures and logout/refresh themselves must not trigger a refresh.
const canRefresh = (url: string) =>
  !/\/api\/auth\/(login|logout|refresh)(?:\?|$)/.test(url);

const fetchWithRefresh: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.status !== 401 || init?.signal?.aborted) return response;

  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (!canRefresh(url) || !(await refreshSession())) return response;

  // Retry once with the rotated cookies. Hono builds the body from a string or
  // FormData, so the same init can safely be sent again.
  return fetch(input, init);
};

export const client = hc<AppType>(baseUrl, {
  init: { credentials: "include" },
  fetch: fetchWithRefresh,
});

export type Session = Pick<
  InferResponseType<typeof client.api.auth.me.$get, 200>["data"],
  "user" | "schoolDate"
>;
