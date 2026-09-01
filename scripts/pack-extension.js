import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');

function packageFolder(folderName, zipName) {
  const srcDir = resolve(distDir, folderName);
  const zipOutput = resolve(distDir, zipName);

  if (!existsSync(srcDir)) {
    console.warn(`Warning: ${srcDir} does not exist. Skipping ${zipName}`);
    return;
  }

  if (existsSync(zipOutput)) {
    unlinkSync(zipOutput);
  }

  console.log(`Packaging ${folderName} -> ${zipName}...`);

  try {
    // Linux/WSL/macOS zip
    execSync(`cd "${srcDir}" && zip -r "${zipOutput}" . -x "*.DS_Store"`, { stdio: 'pipe' });
    console.log(`  -> Created ${zipOutput}`);
    return;
  } catch {}

  // Windows PowerShell fallback
  const winSrc = srcDir.replace(/^\/mnt\/([a-z])\//, '$1:/').replace(/\//g, '\\');
  const winZip = zipOutput.replace(/^\/mnt\/([a-z])\//, '$1:/').replace(/\//g, '\\');
  const cmd = `powershell.exe -Command "Compress-Archive -Path '${winSrc}\\*' -DestinationPath '${winZip}' -CompressionLevel Optimal"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`  -> Created ${zipOutput}`);
}

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Package Chrome (both filename conventions for store & repo releases)
packageFolder('chrome', 'aether-chrome-v0.1.0.zip');
packageFolder('chrome', 'aether-browser-bridge-v0.1.0.zip');

// Package Firefox
packageFolder('firefox', 'aether-firefox-v0.1.0.zip');

console.log('\nAll browser bundles packaged successfully!\n');
