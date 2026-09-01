import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { BridgeServer } from './bridge-server.js';
import { 
  BrowserAction, 
  DOMSerializerOptions, 
  DOMSnapshot, 
  NavigationOptions, 
  ScreenshotOptions, 
  ScreenshotResult, 
  TabInfo 
} from '../types/index.js';

// Define MCP Tools
const GET_ACTIVE_TAB_TOOL: Tool = {
  name: 'get_active_tab',
  description: 
    'Fetches the active Chrome tab and returns a compact, token-pruned numbered Markdown snapshot (<1,000 tokens). Interactive elements (links, buttons, inputs, selects, textareas) are indexed with [1], [2], [3], etc. for subsequent interaction.',
  inputSchema: {
    type: 'object',
    properties: {
      viewportOnly: {
        type: 'boolean',
        description: 'If true, only serializes elements currently visible within the viewport.'
      },
      filterHidden: {
        type: 'boolean',
        description: 'If true (default), prunes hidden/invisible elements.'
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum DOM tree depth to traverse (default: 32).'
      }
    }
  }
};

const INTERACT_ELEMENT_TOOL: Tool = {
  name: 'interact_element',
  description: 
    'Executes a high-fidelity synthetic user action (click, type, select, scroll, hover, press_key, clear) on an element ID ([1], [2], etc.) from the active DOM snapshot.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['click', 'type', 'select', 'scroll', 'hover', 'press_key', 'focus', 'clear'],
        description: 'The browser interaction type.'
      },
      elementId: {
        type: 'number',
        description: 'The numeric ID [N] of the target interactive element.'
      },
      text: {
        type: 'string',
        description: 'Text string to type (for type action) or key name (for press_key action).'
      },
      value: {
        type: 'string',
        description: 'Target value or text to select for <select> elements or form inputs.'
      },
      clearExisting: {
        type: 'boolean',
        description: 'If true (default), clears existing input value before typing.'
      },
      pressEnter: {
        type: 'boolean',
        description: 'If true, simulates pressing Enter after typing.'
      },
      key: {
        type: 'string',
        description: 'Specific key to press (e.g., Enter, Tab, Escape, ArrowDown).'
      },
      scrollDirection: {
        type: 'string',
        enum: ['up', 'down', 'top', 'bottom'],
        description: 'Direction to scroll the page or target element.'
      },
      scrollAmount: {
        type: 'number',
        description: 'Number of pixels to scroll (default: 500).'
      }
    },
    required: ['action']
  }
};

const CAPTURE_VIEWPORT_TOOL: Tool = {
  name: 'capture_viewport',
  description: 
    'Captures a visual screenshot of the current active Chrome viewport and returns base64 image data.',
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['png', 'jpeg'],
        description: 'Image format (default: png).'
      },
      quality: {
        type: 'number',
        description: 'Image quality 1-100 (for jpeg format, default: 80).'
      }
    }
  }
};

const NAVIGATE_TAB_TOOL: Tool = {
  name: 'navigate_tab',
  description: 
    'Navigates the active Chrome tab to a target URL or opens a new tab.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to navigate to (e.g. https://github.com).'
      },
      newTab: {
        type: 'boolean',
        description: 'If true, opens the URL in a new tab instead of the active tab.'
      }
    },
    required: ['url']
  }
};

const GET_BROWSER_STATUS_TOOL: Tool = {
  name: 'get_browser_status',
  description: 
    'Checks connection status between the MCP server and the Chrome Extension, returning active tab metadata.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export async function createMcpServer(bridgeServer?: BridgeServer): Promise<Server> {
  const bridge = bridgeServer ?? new BridgeServer();
  await bridge.start();

  const server = new Server(
    {
      name: 'aether-browser-mcp',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List Tools Handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      GET_ACTIVE_TAB_TOOL,
      INTERACT_ELEMENT_TOOL,
      CAPTURE_VIEWPORT_TOOL,
      NAVIGATE_TAB_TOOL,
      GET_BROWSER_STATUS_TOOL
    ]
  }));

  // Call Tool Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_active_tab': {
          const options = args as DOMSerializerOptions | undefined;
          const snapshot = await bridge.sendRequest<DOMSnapshot>('GET_DOM_SNAPSHOT', options);
          return {
            content: [
              {
                type: 'text',
                text: snapshot.markdown
              }
            ]
          };
        }

        case 'interact_element': {
          const action = args as unknown as BrowserAction;
          const result = await bridge.sendRequest<any>('EXECUTE_ACTION', action);
          
          // After interaction, automatically fetch fresh compact snapshot
          let snapshotText = '';
          try {
            const freshSnapshot = await bridge.sendRequest<DOMSnapshot>('GET_DOM_SNAPSHOT', { viewportOnly: false }, 5000);
            snapshotText = `\n\n### Updated Page State:\n${freshSnapshot.markdown}`;
          } catch {
            // Snapshot refresh optional
          }

          return {
            content: [
              {
                type: 'text',
                text: `Action Result: ${JSON.stringify(result, null, 2)}${snapshotText}`
              }
            ]
          };
        }

        case 'capture_viewport': {
          const options = (args || {}) as ScreenshotOptions;
          const screenshot = await bridge.sendRequest<ScreenshotResult>('CAPTURE_VIEWPORT', options);
          
          return {
            content: [
              {
                type: 'text',
                text: `Captured viewport screenshot (${screenshot.mimeType}, ${screenshot.width ?? '?'}x${screenshot.height ?? '?'})`
              },
              {
                type: 'image',
                data: screenshot.dataUrl.replace(/^data:image\/\w+;base64,/, ''),
                mimeType: screenshot.mimeType
              }
            ]
          };
        }

        case 'navigate_tab': {
          const nav = args as unknown as NavigationOptions;
          const navResult = await bridge.sendRequest<any>('NAVIGATE', nav, 25000);
          
          // Get immediate snapshot of the newly navigated page
          const snapshot = await bridge.sendRequest<DOMSnapshot>('GET_DOM_SNAPSHOT', {}, 10000);

          return {
            content: [
              {
                type: 'text',
                text: `Navigated to ${nav.url}\n\n${snapshot.markdown}`
              }
            ]
          };
        }

        case 'get_browser_status': {
          const tabInfo = await bridge.sendRequest<TabInfo>('GET_TAB_INFO');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  connected: bridge.isConnected(),
                  activeTab: tabInfo,
                  version: '0.1.0'
                }, null, 2)
              }
            ]
          };
        }

        default:
          throw new Error(`Unknown tool name: ${name}`);
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[Antigravity Browser Bridge Error]: ${err?.message || String(err)}`
          }
        ]
      };
    }
  });

  return server;
}

// Standalone execution entrypoint
async function main() {
  const bridge = new BridgeServer();
  const server = await createMcpServer(bridge);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Antigravity MCP Bridge] Server running on stdio');
}

if (process.argv[1] && (process.argv[1].endsWith('mcp/index.js') || process.argv[1].endsWith('mcp\\index.js'))) {
  main().catch((err) => {
    console.error('[Antigravity MCP Bridge] Fatal startup error:', err);
    process.exit(1);
  });
}
