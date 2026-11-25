import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [cloudflare()],
    build: {
      minify: true,
    },
  };
});
