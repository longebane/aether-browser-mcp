import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { BridgeServer } from '../src/mcp/bridge-server.js';
import { createMcpServer } from '../src/mcp/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('MCP Server & Bridge Integration', () => {
  let bridge: BridgeServer;
  const testPort = 18889; // Use alternate port for tests

  beforeEach(async () => {
    bridge = new BridgeServer({ port: testPort, defaultTimeoutMs: 3000 });
  });

  afterEach(async () => {
    await bridge.stop();
  });

  it('initializes and lists all 5 browser automation tools', async () => {
    const server = await createMcpServer(bridge);
    
    const listHandler = (server as any)._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    expect(listHandler).toBeDefined();

    const response = await listHandler({
      method: 'tools/list',
      params: {}
    });
    const toolNames = response.tools.map((t: any) => t.name);

    expect(toolNames).toContain('get_active_tab');
    expect(toolNames).toContain('interact_element');
    expect(toolNames).toContain('capture_viewport');
    expect(toolNames).toContain('navigate_tab');
    expect(toolNames).toContain('get_browser_status');
  });

  it('rejects tool calls when no extension client is connected', async () => {
    const server = await createMcpServer(bridge);
    const callHandler = (server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);

    const result = await callHandler({
      method: 'tools/call',
      params: {
        name: 'get_active_tab',
        arguments: {}
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No active Chrome Extension connected');
  });

  it('executes get_active_tab when extension responds', async () => {
    const server = await createMcpServer(bridge);

    // Mock Chrome Extension connecting via WebSocket
    const mockExtension = new WebSocket(`ws://127.0.0.1:${testPort}`);

    await new Promise<void>((resolve) => {
      mockExtension.on('open', () => resolve());
    });

    // Handle incoming command and send mock snapshot response
    mockExtension.on('message', (data: string) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'GET_DOM_SNAPSHOT') {
        mockExtension.send(JSON.stringify({
          id: msg.id,
          success: true,
          data: {
            url: 'https://studio-dao.com',
            title: 'Studio DAO Dashboard',
            markdown: '# Welcome\n\n[1] [Login Button](/login)',
            elementCount: 10,
            interactiveCount: 1,
            estimatedTokens: 25,
            timestamp: Date.now()
          }
        }));
      }
    });

    const callHandler = (server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);

    const result = await callHandler({
      method: 'tools/call',
      params: {
        name: 'get_active_tab',
        arguments: {}
      }
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('# Welcome');
    expect(result.content[0].text).toContain('[1] [Login Button](/login)');

    mockExtension.close();
  });

  it('executes interact_element action and returns updated page state', async () => {
    const server = await createMcpServer(bridge);

    const mockExtension = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      mockExtension.on('open', () => resolve());
    });

    mockExtension.on('message', (data: string) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'EXECUTE_ACTION') {
        mockExtension.send(JSON.stringify({
          id: msg.id,
          success: true,
          data: {
            success: true,
            action: 'click',
            elementId: 1,
            details: 'Clicked [1] <button>'
          }
        }));
      } else if (msg.type === 'GET_DOM_SNAPSHOT') {
        mockExtension.send(JSON.stringify({
          id: msg.id,
          success: true,
          data: {
            url: 'https://studio-dao.com/logged-in',
            title: 'Logged In',
            markdown: '# Dashboard\n\nWelcome User!',
            elementCount: 5,
            interactiveCount: 0,
            estimatedTokens: 15,
            timestamp: Date.now()
          }
        }));
      }
    });

    const callHandler = (server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);

    const result = await callHandler({
      method: 'tools/call',
      params: {
        name: 'interact_element',
        arguments: {
          action: 'click',
          elementId: 1
        }
      }
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Action Result');
    expect(result.content[0].text).toContain('Clicked [1] <button>');
    expect(result.content[0].text).toContain('Updated Page State');
    expect(result.content[0].text).toContain('# Dashboard');

    mockExtension.close();
  });
});
