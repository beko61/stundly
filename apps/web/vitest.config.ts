import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    globals: true,
    server: {
      deps: {
        // Root node_modules'ta react-dom@18 hoist edilmiş (next-intl → next@14 peer'i).
        // @testing-library/react'i inline edip aşağıdaki alias ile web'in react-dom@19'una bağla.
        inline: [/@testing-library\/react/],
      },
    },
  },
  resolve: {
    alias: [
      { find: "@workly/shared", replacement: path.resolve(__dirname, "../../packages/shared/src/index.ts") },
      { find: /^@\//, replacement: path.resolve(__dirname, "./src") + "/" },
      { find: /^react-dom(\/.*)?$/, replacement: path.resolve(__dirname, "node_modules/react-dom") + "$1" },
      // CJS main'i Node require ile alias'ı atlıyor — ESM build'ini zorla ki import'lar alias'tan geçsin.
      { find: /^@testing-library\/react$/, replacement: path.resolve(__dirname, "../../node_modules/@testing-library/react/dist/@testing-library/react.esm.js") },
    ],
  },
});
