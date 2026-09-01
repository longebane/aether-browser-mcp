import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const targetBrowser = process.env.TARGET_BROWSER === 'firefox' ? 'firefox' : 'chrome';
const outDirName = targetBrowser === 'firefox' ? 'dist/firefox' : 'dist/chrome';

export default defineConfig({
  base: './',
  build: {
    outDir: outDirName,
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'popup') return 'popup.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [
    {
      name: 'copy-manifest-and-assets',
      closeBundle() {
        const outDir = resolve(__dirname, outDirName);
        if (!existsSync(outDir)) {
          mkdirSync(outDir, { recursive: true });
        }

        // Copy matching manifest
        const manifestFileName = targetBrowser === 'firefox' ? 'manifest.firefox.json' : 'manifest.json';
        const manifestSrc = resolve(__dirname, `extension/${manifestFileName}`);
        const manifestDest = resolve(outDir, 'manifest.json');
        if (existsSync(manifestSrc)) {
          copyFileSync(manifestSrc, manifestDest);
        }

        // Copy icons directory
        const iconsSrcDir = resolve(__dirname, 'extension/icons');
        const iconsDestDir = resolve(outDir, 'icons');
        if (existsSync(iconsSrcDir)) {
          if (!existsSync(iconsDestDir)) mkdirSync(iconsDestDir, { recursive: true });
          for (const iconFile of ['icon16.png', 'icon48.png', 'icon128.png', 'icon.svg']) {
            const src = resolve(iconsSrcDir, iconFile);
            if (existsSync(src)) copyFileSync(src, resolve(iconsDestDir, iconFile));
          }
        }

        // If Vite placed popup in src/popup/index.html, also make it available as popup.html
        const nestedPopup = resolve(outDir, 'src/popup/index.html');
        const rootPopup = resolve(outDir, 'popup.html');
        if (existsSync(nestedPopup)) {
          const content = readFileSync(nestedPopup, 'utf-8');
          writeFileSync(rootPopup, content.replace(/src=["'](\.\.\/)+popup\.js["']/, 'src="./popup.js"'));
        }

        // Also duplicate to dist/extension for backwards compatibility if building chrome
        if (targetBrowser === 'chrome') {
          const legacyOut = resolve(__dirname, 'dist/extension');
          if (!existsSync(legacyOut)) mkdirSync(legacyOut, { recursive: true });
          copyFileSync(manifestDest, resolve(legacyOut, 'manifest.json'));
          if (existsSync(resolve(outDir, 'background.js'))) copyFileSync(resolve(outDir, 'background.js'), resolve(legacyOut, 'background.js'));
          if (existsSync(resolve(outDir, 'content.js'))) copyFileSync(resolve(outDir, 'content.js'), resolve(legacyOut, 'content.js'));
          if (existsSync(rootPopup)) copyFileSync(rootPopup, resolve(legacyOut, 'popup.html'));
          if (existsSync(resolve(outDir, 'popup.js'))) copyFileSync(resolve(outDir, 'popup.js'), resolve(legacyOut, 'popup.js'));
          
          const legacyIcons = resolve(legacyOut, 'icons');
          if (!existsSync(legacyIcons)) mkdirSync(legacyIcons, { recursive: true });
          for (const iconFile of ['icon16.png', 'icon48.png', 'icon128.png', 'icon.svg']) {
            const src = resolve(iconsSrcDir, iconFile);
            if (existsSync(src)) copyFileSync(src, resolve(legacyIcons, iconFile));
          }
        }
      }
    }
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10000
  }
});
