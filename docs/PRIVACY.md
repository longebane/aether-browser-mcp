# Privacy Policy for Aether Browser Bridge

**Last updated: September 1, 2026**

Aether Browser Bridge ("the Extension") is an open-source tool developed by Studio Dao. This policy describes how the Extension handles user data.

---

## 1. Local-Only Execution & No Data Collection

- **Zero External Telemetry**: The Extension does not collect, record, track, or transmit any personal information, browsing history, keystrokes, passwords, or cookies to external servers or third parties.
- **Local IPC Communication**: All data exchange occurs strictly on `localhost` (127.0.0.1) between the Chrome extension and your local Model Context Protocol (MCP) process via Chrome Native Messaging and local WebSocket IPC.

---

## 2. Permissions & Data Handling

- **`activeTab` & `scripting`**: Used in-memory to parse the DOM of the active tab into a token-pruned markdown map when explicitly invoked by your local AI client (Claude, Cursor, Antigravity). No webpage data is retained or uploaded.
- **`tabs` & `tabGroups`**: Used to navigate and isolate agent tasks in a dedicated Chrome tab group.
- **`nativeMessaging`**: Used to communicate with the local Node.js MCP server process running on your machine.
- **`storage`**: Used to save local extension preferences and session state in your local Chrome browser storage.

---

## 3. Third-Party Sharing

The Extension does not sell, rent, monetize, or share user data with any third parties or advertisers.

---

## 4. Open Source Transparency

The full source code of the Extension is publicly available for audit at:  
https://github.com/longebane/aether-browser-mcp

---

## 5. Contact

For questions regarding this privacy policy, open an issue on the official GitHub repository or contact:  
contact@studiodao.com
