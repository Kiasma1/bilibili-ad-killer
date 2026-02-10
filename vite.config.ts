import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, cpSync, watch, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
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
      name: 'inline-chunks-into-inject',
      closeBundle() {
        // inject.js is loaded into the page via <script> tag (not ES module),
        // so it cannot use import statements. This plugin inlines any chunk
        // imports directly into inject.js, then wraps it in an IIFE.
        const distDir = resolve(__dirname, 'dist');
        const injectPath = resolve(distDir, 'inject.js');
        if (!existsSync(injectPath)) return;

        let injectContent = readFileSync(injectPath, 'utf-8');

        // Find all import statements like: import{x as y}from"./chunk.js";
        const importRegex = /import\{([^}]*)\}from"\.\/([^"]+)";/g;
        const chunksToInline = new Set<string>();
        let match;

        while ((match = importRegex.exec(injectContent)) !== null) {
          chunksToInline.add(match[2]);
        }

        // For each chunk, read its content and inline the exports
        for (const chunkFile of chunksToInline) {
          const chunkPath = resolve(distDir, chunkFile);
          if (!existsSync(chunkPath)) continue;

          let chunkContent = readFileSync(chunkPath, 'utf-8');

          // Extract export mappings: export{x as A, y as B}
          const exportMatch = chunkContent.match(/export\{([^}]+)\}/);
          if (!exportMatch) continue;

          // Parse export pairs: "localName as exportedName"
          const exportPairs = exportMatch[1].split(',').map(pair => {
            const parts = pair.trim().split(/\s+as\s+/);
            return { local: parts[0], exported: parts[1] || parts[0] };
          });

          // Remove the export statement from chunk content
          const chunkCode = chunkContent.replace(/export\{[^}]+\};?\s*$/, '').trim();

          // Build the import pattern for this chunk
          const importPattern = new RegExp(
            `import\\{([^}]*)\\}from"\\.\\/${chunkFile.replace('.', '\\.')}";`
          );
          const importMatch = injectContent.match(importPattern);
          if (!importMatch) continue;

          // Parse import bindings: "exportedName as localAlias"
          const importBindings = importMatch[1].split(',').map(pair => {
            const parts = pair.trim().split(/\s+as\s+/);
            return { imported: parts[0], local: parts[1] || parts[0] };
          });

          // Build variable declarations mapping imported names to local chunk variables
          // Wrap chunk code in its own IIFE to avoid variable name collisions
          // between chunk locals and inject.js locals (e.g. Google GenAI SDK)
          const returnProps = importBindings.map(binding => {
            const exportPair = exportPairs.find(ep => ep.exported === binding.imported);
            if (!exportPair) return '';
            return `${binding.local}:${exportPair.local}`;
          }).filter(Boolean).join(',');

          const wrappedChunk = `var{${returnProps}}=(function(){${chunkCode};return{${returnProps}}})();`;

          // Replace the import statement with the wrapped chunk
          injectContent = injectContent.replace(importPattern, wrappedChunk);

          console.log(`✅ Inlined ${chunkFile} into inject.js`);
        }

        // Wrap in IIFE
        const wrapped = `(function() {\n${injectContent}\n})();`;
        writeFileSync(injectPath, wrapped, 'utf-8');
        console.log('✅ Wrapped inject.js in IIFE');
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

