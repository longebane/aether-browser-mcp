import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docsDir = resolve(__dirname, '../docs');
if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

const htmlPath = resolve(docsDir, 'screenshot_preview.html');
const screenshotPng = resolve(docsDir, 'screenshot_1280x800.png');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      width: 1280px;
      height: 800px;
      background: #09090b;
      color: #f4f4f5;
      display: flex;
      flex-direction: column;
      padding: 36px 48px;
      overflow: hidden;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo {
      width: 38px;
      height: 38px;
      background: #09090b;
      border: 1.5px solid #27272a;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #fafafa;
    }
    .badge {
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .stats {
      display: flex;
      gap: 20px;
      font-size: 13px;
      color: #a1a1aa;
    }
    .stat-item span {
      color: #38bdf8;
      font-weight: 600;
    }
    .workspace {
      display: grid;
      grid-template-columns: 1fr 1.15fr;
      gap: 24px;
      flex: 1;
    }
    .window {
      background: #111114;
      border: 1px solid #27272a;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .window-header {
      background: #18181b;
      padding: 12px 16px;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .dots {
      display: flex;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #eab308; }
    .dot-green { background: #22c55e; }
    .window-title {
      font-size: 12px;
      font-weight: 500;
      color: #a1a1aa;
      font-family: 'JetBrains Mono', monospace;
    }
    .window-body {
      flex: 1;
      padding: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      line-height: 1.65;
      overflow: hidden;
    }
    .json-key { color: #38bdf8; }
    .json-str { color: #a5f3fc; }
    .json-num { color: #f472b6; }
    .tag { color: #a1a1aa; }
    .highlight-box {
      background: rgba(56, 189, 248, 0.08);
      border-left: 3px solid #38bdf8;
      padding: 10px 14px;
      margin: 12px 0;
      border-radius: 0 6px 6px 0;
    }
    .chrome-tabbar {
      background: #18181b;
      padding: 10px 14px 0 14px;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    .chrome-group {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid #38bdf8;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chrome-tab {
      background: #27272a;
      border-radius: 6px 6px 0 0;
      padding: 6px 14px;
      font-size: 12px;
      color: #f4f4f5;
    }
    .browser-body {
      background: #0d0d10;
      flex: 1;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .web-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 16px;
    }
    .action-badge {
      display: inline-block;
      background: #38bdf8;
      color: #09090b;
      font-weight: 800;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 6px;
    }
    .web-title {
      font-size: 15px;
      font-weight: 600;
      color: #fafafa;
      margin-bottom: 8px;
    }
    .web-text {
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.5;
    }
    .cursor-pointer {
      position: absolute;
      right: 140px;
      bottom: 180px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cursor-badge {
      background: #09090b;
      border: 1px solid #38bdf8;
      color: #38bdf8;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo">
        <svg width="22" height="22" viewBox="0 0 128 128">
          <path d="M64 22L28 98H47L56 76H72L81 98H100L64 22Z" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linejoin="round"/>
          <path d="M54 68L64 43L74 68H54Z" fill="#38bdf8"/>
          <circle cx="64" cy="100" r="5" fill="#38bdf8"/>
        </svg>
      </div>
      <div class="title">Aether Browser MCP</div>
      <div class="badge">Model Context Protocol</div>
    </div>
    <div class="stats">
      <div class="stat-item">Payload: <span>&lt;1,000 tokens</span></div>
      <div class="stat-item">Compression: <span>95% vs Raw HTML</span></div>
      <div class="stat-item">Session: <span>Active Tab Reuse</span></div>
    </div>
  </div>

  <div class="workspace">
    <!-- Left Panel: Claude / Cursor MCP Client -->
    <div class="window">
      <div class="window-header">
        <div class="dots">
          <div class="dot dot-red"></div>
          <div class="dot dot-yellow"></div>
          <div class="dot dot-green"></div>
        </div>
        <div class="window-title">AI Agent (Claude / Cursor / Antigravity)</div>
      </div>
      <div class="window-body">
        <div style="color: #71717a;">// Calling MCP tool: get_active_tab</div>
        <div style="color: #38bdf8; margin-top: 4px;">&gt; aether.get_active_tab({ inspectActive: true })</div>
        
        <div class="highlight-box">
          <div style="color: #a1a1aa; font-weight: 600; margin-bottom: 4px;">DOM Snapshot (&lt;420 tokens):</div>
          <div># Linear - Active Cycle</div>
          <div>| ID | Issue | Status | Action |</div>
          <div>|---|---|---|---|</div>
          <div>| <span class="action-badge">[1]</span> | ENG-402 API Gateway | In Review | <span class="action-badge">[2]</span> Review |</div>
          <div>| <span class="action-badge">[3]</span> | ENG-409 Auth Flow | In Progress | <span class="action-badge">[4]</span> Assign |</div>
        </div>

        <div style="color: #71717a; margin-top: 14px;">// Non-destructive interaction</div>
        <div style="color: #38bdf8;">&gt; aether.interact_element({ action: "click", elementId: 2 })</div>
        <div style="color: #4ade80; margin-top: 4px;">✓ Executed click on anchor [2]</div>
      </div>
    </div>

    <!-- Right Panel: Google Chrome with Dedicated Tab Group -->
    <div class="window" style="position: relative;">
      <div class="chrome-tabbar">
        <div class="chrome-group">
          ⚡ Aether Agent
        </div>
        <div class="chrome-tab">
          Linear - Active Cycle
        </div>
      </div>
      <div class="browser-body">
        <div class="web-card">
          <div class="web-title"><span class="action-badge">[1]</span> ENG-402: API Gateway Resilience</div>
          <div class="web-text">Production gateway latency optimizations and token bucket rate limiters.</div>
          <div style="margin-top: 12px;">
            <button style="background: #0284c7; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
              <span class="action-badge">[2]</span> Review Pull Request
            </button>
          </div>
        </div>

        <div class="web-card">
          <div class="web-title"><span class="action-badge">[3]</span> ENG-409: Session Token Lifecycle</div>
          <div class="web-text">Handling background refresh rotations across multi-tenant instances.</div>
          <div style="margin-top: 12px;">
            <button style="background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              <span class="action-badge">[4]</span> Assignee
            </button>
          </div>
        </div>
      </div>

      <!-- Agent Glide Cursor -->
      <div class="cursor-pointer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 3.5L11.5 20.5L14.5 13.5L21.5 10.5L5.5 3.5Z" fill="#38bdf8" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
        <div class="cursor-badge">[2] Click</div>
      </div>
    </div>
  </div>
</body>
</html>`;

writeFileSync(htmlPath, htmlContent);

try {
  const cmd = `"${chromePath}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=1280,800 --default-background-color=09090b --screenshot="${screenshotPng}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
  execSync(cmd, { stdio: 'ignore' });
  console.log(`Successfully generated 1280x800 screenshot:`);
  console.log(`-> ${screenshotPng}`);
} catch (err) {
  console.error('Screenshot generation failed:', err);
} finally {
  try {
    execSync(`powershell -Command "if (Test-Path '${htmlPath}') { Remove-Item '${htmlPath}' }"`);
  } catch {}
}
