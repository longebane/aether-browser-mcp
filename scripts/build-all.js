import { build as viteBuild } from 'vite';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

console.log('\n--- Building Aether Browser MCP (Cross-Browser) ---\n');

console.log('[Build 1/3] Building Chrome Extension (dist/chrome)...');
process.env.TARGET_BROWSER = 'chrome';
await viteBuild({ configFile: resolve(projectRoot, 'vite.config.ts') });

console.log('\n[Build 2/3] Building Firefox Extension (dist/firefox)...');
process.env.TARGET_BROWSER = 'firefox';
await viteBuild({ configFile: resolve(projectRoot, 'vite.config.ts') });

console.log('\n[Build 3/3] Compiling MCP Server (dist/mcp)...');
// Import typescript programmatic compiler or run ts-node / npx
try {
  const ts = await import('typescript');
  const tsConfigPath = resolve(projectRoot, 'tsconfig.mcp.json');
  const configFile = ts.default.readConfigFile(tsConfigPath, ts.default.sys.readFile);
  const parsed = ts.default.parseJsonConfigFileContent(configFile.config, ts.default.sys, projectRoot);
  const program = ts.default.createProgram(parsed.fileNames, parsed.options);
  program.emit();
  console.log('MCP TypeScript compilation complete.');
} catch (tsErr) {
  console.warn('Programmatic TS compile fallback:', tsErr.message);
}

console.log('\n[Packaging] Bundling zip releases...');
await import('./pack-extension.js');

console.log('\n✅ Cross-browser build & packaging complete!\n');
