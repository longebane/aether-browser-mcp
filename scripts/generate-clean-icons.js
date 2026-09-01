import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconsDir = resolve(__dirname, '../extension/icons');
const distIconsDir = resolve(__dirname, '../dist/extension/icons');
if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true });

// Refined original "A" chevron mark — completely flat, crisp, zero glow / blur filters
const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <!-- Matte dark carbon background with subtle border -->
  <rect width="128" height="128" rx="26" fill="#09090b" stroke="#27272a" stroke-width="2"/>

  <!-- Crisp, flat stylized A / Chevron structure -->
  <path d="M64 22L28 98H47L56 76H72L81 98H100L64 22Z" fill="none" stroke="#38bdf8" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round"/>
  
  <!-- Solid inner core chevron -->
  <path d="M54 68L64 43L74 68H54Z" fill="#38bdf8"/>

  <!-- Anchor pulse dot -->
  <circle cx="64" cy="100" r="4.5" fill="#38bdf8"/>
</svg>`;

writeFileSync(resolve(iconsDir, 'icon.svg'), masterSvg);
writeFileSync(resolve(distIconsDir, 'icon.svg'), masterSvg);
console.log('Saved vector SVG to extension/icons/icon.svg');

// Render pixel-perfect PNGs via Chrome Headless
const sizes = [16, 48, 128, 512];
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

for (const size of sizes) {
  const htmlPath = resolve(__dirname, `../temp_icon_${size}.html`);
  const pngDest = resolve(iconsDir, `icon${size}.png`);
  const distPngDest = resolve(distIconsDir, `icon${size}.png`);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; width: ${size}px; height: ${size}px; overflow: hidden; }
    svg { width: ${size}px; height: ${size}px; display: block; }
  </style>
</head>
<body>
  ${masterSvg}
</body>
</html>`;

  writeFileSync(htmlPath, htmlContent);

  try {
    const cmd = `"${chromePath}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=${size},${size} --default-background-color=00000000 --screenshot="${pngDest}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
    execSync(cmd, { stdio: 'ignore' });
    execSync(`powershell -Command "Copy-Item '${pngDest}' -Destination '${distPngDest}' -Force"`);
    console.log(`Rendered icon${size}.png (${size}x${size})`);
  } catch (err) {
    console.error(`Failed to render icon${size}.png:`, err);
  } finally {
    try {
      execSync(`powershell -Command "if (Test-Path '${htmlPath}') { Remove-Item '${htmlPath}' }"`);
    } catch {}
  }
}

console.log('All icons updated successfully.');
