# Aether Browser MCP

A lightweight, token-efficient browser automation bridge for LLM agents (Claude Desktop, Cursor, Windsurf, Antigravity) built on the Model Context Protocol (MCP).

Unlike standard headless browser tools or raw Chrome DevTools protocol wrappers that dump 50,000+ tokens of raw HTML into context, Aether serializes active web pages into a compact, numbered Markdown map (typically <1,000 tokens) and dispatches synthetic event streams.

---

## Origin & Background

Aether started out of frustration with existing tooling like `chrome-devtools-mcp`.

While OpenAI's browser operator proved that lightweight DOM mapping with active-session reuse is the only practical way for models to navigate the web without exhausting context windows, the broader ecosystem was left with raw CDP wrappers that dump 50,000–100,000+ tokens of unstructured HTML per turn.

Aether was originally built to bring that fast, token-efficient browser control to Google Antigravity and Gemini. By implementing it over the standard Model Context Protocol (MCP), it now serves as a universal, lightweight browser bridge for any LLM client or agent harness (Claude Desktop, Cursor, Antigravity, OpenDevin, custom agents).

---

## Why Aether?

Standard browser automation approaches for LLMs have two core issues:

1. **Context Window Exhaustion**: Dumping raw DOM trees or full HTML structures consumes 30k–100k+ tokens per turn, driving up latency and API cost while degrading model reasoning.
2. **Session Isolation**: Headless drivers (Playwright, Puppeteer) launch blank sandbox profiles that lack existing authentication, cookies, and active sessions.

### Technical Mechanism

- **Numbered Anchor Serialization**: Converts the DOM tree into clean Markdown where every actionable element (`<a>`, `<button>`, `<input>`, `<select>`, `contenteditable`, ARIA roles) receives a sequential numeric anchor (`[1]`, `[2]`, `[3]`). Strips scripts, styles, SVGs, and hidden/zero-opacity nodes.
- **Session Continuity**: Connects directly to your daily browser profile via Chrome Native Messaging and a local WebSocket relay (`ws://127.0.0.1:18888`), allowing agents to operate within authenticated sessions.
- **Non-Destructive Tab Grouping**: All agent-directed navigation runs inside a dedicated `⚡ Aether Agent` Chrome Tab Group, preventing personal active tabs from being overwritten.

---

## Architecture

```
[ AI Client ] (Claude Desktop / Cursor / Antigravity)
      |
      | stdio (Model Context Protocol JSON-RPC)
      v
[ Aether MCP Server ] (Node.js 22 / TypeScript)
      |
      | Local IPC (Native Messaging / WebSocket)
      v
[ Aether Chrome Extension ] (Manifest V3)
  ├── Background Worker  (Tab Group & Session Router)
  └── Content Script     (DOM Serializer & Event Dispatcher)
```

---

## Installation & Setup

### 1. Clone and Build

```bash
git clone https://github.com/longebane/aether-browser-mcp.git
cd aether-browser-mcp
npm install
npm run build
```

### 2. Load the Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right.
3. Click **Load unpacked** and select the `dist/extension` folder inside this repository.
4. Copy the generated Extension ID.

### 3. Register the Native Messaging Host

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-host.ps1 -ExtensionId <YOUR_EXTENSION_ID>
```

---

## Client Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aether-browser": {
      "command": "node",
      "args": ["<PATH_TO_AETHER_REPO>/dist/mcp/index.js"]
    }
  }
}
```

### Cursor

Add under **Settings > Features > MCP**:

```json
{
  "cursor.mcpServers": {
    "aether-browser": {
      "command": "node",
      "args": ["<PATH_TO_AETHER_REPO>/dist/mcp/index.js"]
    }
  }
}
```

### Antigravity

Add to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "aether-browser": {
      "command": "node",
      "args": ["<PATH_TO_AETHER_REPO>/dist/mcp/index.js"]
    }
  }
}
```

---

## MCP Tool Reference

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `get_active_tab` | `inspectActive?: boolean` | Serializes current tab into a numbered Markdown action map (`<1,000` tokens). |
| `interact_element` | `action`, `elementId`, `text?`, `pressEnter?` | Executes `click`, `type`, `select`, `scroll`, `hover`, `press_key`, or `clear` on anchor `[N]`. |
| `capture_viewport` | `format?: "png" \| "jpeg"`, `quality?: number` | Captures viewport screenshot for multimodal evaluation. |
| `navigate_tab` | `url`, `newTab?`, `actUponCurrentTab?` | Navigates inside the dedicated `⚡ Aether Agent` tab group. |
| `get_browser_status` | _none_ | Returns extension connectivity and active tab metadata. |

---

## Packaging & Testing

```bash
# Run unit and integration tests (Vitest + JSDOM)
npm test

# Build Chrome Web Store zip bundle
npm run pack:extension
```

Output bundle will be written to `dist/aether-browser-bridge-v0.1.0.zip`.

---

## License

MIT © Studio Dao
