// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import vue from "@astrojs/vue";

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      host: true,
      watch: {
        usePolling: true,
        // Polling for file changes every second, for development with the
        // docker container
        interval: 1000,
      },
    },
    plugins: [tailwindcss()],
  },

  integrations: [vue()],
});
