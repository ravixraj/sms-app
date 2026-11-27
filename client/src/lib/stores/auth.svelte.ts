import { client, type Session } from "#lib/api.js";
import { setAuthoritativeDate } from "#lib/validation.js";

export type User = Session["user"];

export async function fetchUser(): Promise<Session | null> {
  const response = await client.api.auth.me.$get(undefined, {
    init: { signal: AbortSignal.timeout(20_000), cache: "no-store" },
  });
  if (response.status === 401) return null;

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || "Unable to check your account.");
  }
  return result.data;
}

type AuthStore = {
  isAuthenticated: boolean;
  user: User | null;
  /** India date from the server clock, not the device clock. */
  schoolDate: string;
  setUser: (user: User, schoolDate: string) => void;
  clearUser: () => void;
  checkAuth: () => Promise<void>;
  loading: boolean;
  isAdmin: boolean;
};

export const auth: AuthStore = $state({
  user: null as User | null,
  schoolDate: "",
  loading: true,

  get isAuthenticated(): boolean {
    return auth.user !== null;
  },

  get isAdmin(): boolean {
    return auth.user?.role === "ADMIN";
  },

  setUser(user: User, schoolDate: string) {
    auth.user = user;
    auth.schoolDate = schoolDate;
    setAuthoritativeDate(schoolDate);
    auth.loading = false;
  },

  clearUser() {
    auth.user = null;
    auth.schoolDate = "";
    setAuthoritativeDate("");
    auth.loading = false;
  },

  async checkAuth(): Promise<void> {
    auth.loading = true;
    try {
      const session = await fetchUser();
      if (session) auth.setUser(session.user, session.schoolDate);
      else auth.clearUser();
    } catch {
      auth.clearUser();
    }
  },
});
