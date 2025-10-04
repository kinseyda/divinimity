// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import vue from "@astrojs/vue";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      host: true,
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
    plugins: [tailwindcss(), nodePolyfills()],
  },

  integrations: [vue()],
});
