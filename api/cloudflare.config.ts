import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "sms-api",
    compatibilityDate: "2026-11-01",
    entrypoint,
    env: {
      DATABASE_URL: bindings.secret(),
      CLIENT_URL: bindings.text("http://localhost:5173"),
      ACCESS_TOKEN_SECRET: bindings.secret(),
      ACCESS_TOKEN_EXPIRY: bindings.text("1800"),
      REFRESH_TOKEN_SECRET: bindings.secret(),
      REFRESH_TOKEN_EXPIRY: bindings.text("1209600"),
      USER_AVATARS: bindings.r2(),
    },
  },
});
