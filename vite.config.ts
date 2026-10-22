import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";

// Defining the configuration for the Vite build tool.
export default defineConfig(({ mode }) => {
  const isHttps = mode === "https" || process.env.HTTPS === "true";

  return {
    base: './', // Adicionado para compatibilidade com Electron
    server: {
      host: "::",
      port: 8080,
      allowedHosts: true,
    },
    plugins: [
      dyadComponentTagger(),
      react(),
      isHttps ? basicSsl() : null,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});