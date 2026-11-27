import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  API_URL: {
    public: true,
    static: true,
    description:
      "Production API origin. Local development uses the Vite /api proxy.",
  },
});
