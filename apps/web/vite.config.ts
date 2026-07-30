import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = process.env.TABLIODB_SERVER_URL || 'http://localhost:4000';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              priority: 60,
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'vendor-x6',
              priority: 55,
              test: /node_modules[\\/](@antv[\\/]x6|dom-align|mousetrap|lodash-es|utility-types)[\\/]/,
            },
            {
              name: 'vendor-router-query-form',
              priority: 50,
              test: /node_modules[\\/](react-router|@tanstack[\\/]react-query|react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/,
            },
            {
              name: 'vendor-ui',
              priority: 45,
              test: /node_modules[\\/](@radix-ui|lucide-react|class-variance-authority)[\\/]/,
            },
          ],
          // Smaller target chunks remove the build warning without hiding real future regressions behind a raised limit.
          maxSize: 450 * 1024,
          minSize: 20 * 1024,
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    // Vite 8 resolves tsconfig paths natively, so the extra plugin is no longer needed in dev or build.
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
