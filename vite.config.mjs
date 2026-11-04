import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";

const pages = ["main", "login", "account", "dataset-view", "image-view", "statistic"];

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // One Vue instance for both `import` and the `require("vue")` inside Quasar's UMD build.
    alias: { vue: "vue/dist/vue.runtime.esm.js" },
  },
  base: "/dist/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, `src/js/${p}.js`])),
    },
  },
});
