import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, cpSync, watch, readFileSync, writeFileSync } from 'fs';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        inject: resolve(__dirname, 'src/inject.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  },
  plugins: [
    react(),
    {
      name: 'wrap-inject-in-iife',
      closeBundle() {
        // Wrap inject.js in IIFE to prevent variable name conflicts
        const injectPath = resolve(__dirname, 'dist/inject.js');
        if (existsSync(injectPath)) {
          const content = readFileSync(injectPath, 'utf-8');
          const wrapped = `(function() {\n${content}\n})();`;
          writeFileSync(injectPath, wrapped, 'utf-8');
          console.log('✅ Wrapped inject.js in IIFE to prevent variable conflicts');
        }
      }
    },
    {
      name: 'copy-extension-files',
      configureServer(server) {
        // Watch _locales folder in dev mode
        if (existsSync('src/_locales')) {
          watch('src/_locales', { recursive: true }, (eventType, filename) => {
            if (filename && filename.endsWith('.json')) {
              console.log(`[i18n] Detected change in ${filename}, copying to dist...`);
              cpSync('src/_locales', 'dist/_locales', { recursive: true });
              // Trigger HMR
              server.ws.send({
                type: 'full-reload',
                path: '*'
              });
            }
          });
        }
        
        // Watch manifest.json in dev mode
        watch('manifest.json', (eventType, filename) => {
          console.log(`[manifest] Detected change, copying to dist...`);
          console.log(`⚠️  Remember to reload the extension in chrome://extensions`);
          copyFileSync('manifest.json', 'dist/manifest.json');
        });
      },
      closeBundle() {
        if (!existsSync('dist')) {
          mkdirSync('dist', { recursive: true });
        }
        // Copy manifest.json
        copyFileSync('manifest.json', 'dist/manifest.json');
        
        // Copy icons folder if it exists
        if (existsSync('src/icons')) {
          cpSync('src/icons', 'dist/icons', { recursive: true });
        }
        
        // Copy _locales folder for i18n
        if (existsSync('src/_locales')) {
          cpSync('src/_locales', 'dist/_locales', { recursive: true });
        }
        
        // Copy lib folder for third-party libraries (toastify, etc.)
        if (existsSync('src/lib')) {
          cpSync('src/lib', 'dist/lib', { recursive: true });
        }
      }
    }
  ]
});

