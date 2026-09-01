import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, mkdirSync, cpSync, rmSync } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');
const sourceZipOutput = resolve(distDir, 'aether-browser-mcp-source.zip');

if (existsSync(sourceZipOutput)) {
  unlinkSync(sourceZipOutput);
}
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

console.log('Packaging clean source code for Mozilla Reviewers...');

const tempDir = resolve(os.tmpdir(), 'aether-source-stage');
if (existsSync(tempDir)) {
  rmSync(tempDir, { recursive: true, force: true });
}
mkdirSync(tempDir, { recursive: true });

// Copy source items
for (const dir of ['src', 'extension', 'host', 'scripts', 'docs']) {
  cpSync(resolve(projectRoot, dir), resolve(tempDir, dir), { recursive: true });
}
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.mcp.json', 'vite.config.ts', 'README.md', 'LICENSE']) {
  if (existsSync(resolve(projectRoot, file))) {
    cpSync(resolve(projectRoot, file), resolve(tempDir, file));
  }
}

// Compress
const winTemp = tempDir.replace(/\//g, '\\');
const winZip = sourceZipOutput.replace(/\//g, '\\');
const psCmd = `powershell.exe -Command "Compress-Archive -Path '${winTemp}\\*' -DestinationPath '${winZip}' -CompressionLevel Optimal"`;
execSync(psCmd, { stdio: 'inherit' });

rmSync(tempDir, { recursive: true, force: true });
console.log(`Successfully created source zip:\n-> ${sourceZipOutput}`);
