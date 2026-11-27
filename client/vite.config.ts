import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:5173",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      tailwindcss(),
      sveltekit({
        compilerOptions: {
          // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
          runes: ({ filename }) =>
            filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
          experimental: { async: true },
        },
        inspector: true,
        adapter: adapter(),
        experimental: { remoteFunctions: true, forkPreloads: true },
      }),
    ],
  };
});
