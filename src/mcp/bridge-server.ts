import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { BridgeMessage, BridgeMessageType, BridgeResponse } from '../types/index.js';

export interface BridgeServerOptions {
  port?: number;
  host?: string;
  defaultTimeoutMs?: number;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

export class BridgeServer {
  private wss: WebSocketServer | null = null;
  private activeSockets: Set<WebSocket> = new Set();
  private clientWs: WebSocket | null = null;
  private isClientMode = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private port: number;
  private host: string;
  private defaultTimeoutMs: number;

  constructor(options?: BridgeServerOptions) {
    this.port = options?.port ?? 18888;
    this.host = options?.host ?? '0.0.0.0';
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 20000;
  }

  /**
   * Starts the WebSocket bridge server or connects as client if already running
   */
  public async start(): Promise<void> {
    if (this.wss || this.clientWs) return;

    try {
      await this.startServer();
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Antigravity MCP Bridge] Port ${this.port} in use. Connecting as client to existing bridge...`);
        await this.connectAsClient();
      } else {
        throw err;
      }
    }
  }

  private startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wss = new WebSocketServer({
          port: this.port,
          host: this.host
        });

        wss.on('listening', () => {
          this.wss = wss;
          console.error(`[Antigravity MCP Bridge] Server listening on ws://${this.host}:${this.port}`);
          resolve();
        });

        wss.on('connection', (ws: WebSocket) => {
          this.activeSockets.add(ws);

          ws.on('message', (data: Buffer | string) => {
            const raw = data.toString();
            // Broadcast / handle message
            this.handleIncomingMessage(raw);

            // Relay message to all other connected sockets (e.g. between client MCP process and extension)
            for (const other of this.activeSockets) {
              if (other !== ws && other.readyState === WebSocket.OPEN) {
                try {
                  other.send(raw);
                } catch {
                  // Ignore relay send errors
                }
              }
            }
          });

          ws.on('close', () => {
            this.activeSockets.delete(ws);
          });

          ws.on('error', (err) => {
            console.error('[Antigravity MCP Bridge] WebSocket socket error:', err);
            this.activeSockets.delete(ws);
          });
        });

        wss.on('error', (err: any) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private connectAsClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isClientMode = true;
      const targetHost = this.host === '0.0.0.0' ? '127.0.0.1' : this.host;
      const ws = new WebSocket(`ws://${targetHost}:${this.port}`);

      ws.on('open', () => {
        this.clientWs = ws;
        console.error(`[Antigravity MCP Bridge] Connected as client to existing bridge on port ${this.port}`);
        resolve();
      });

      ws.on('message', (data: Buffer | string) => {
        this.handleIncomingMessage(data.toString());
      });

      ws.on('close', () => {
        this.clientWs = null;
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Stops the server or client connection
   */
  public async stop(): Promise<void> {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error('Bridge server stopping'));
      this.pendingRequests.delete(id);
    }

    if (this.clientWs) {
      this.clientWs.close();
      this.clientWs = null;
    }

    for (const ws of this.activeSockets) {
      ws.close();
    }
    this.activeSockets.clear();

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss?.close(() => resolve());
      });
      this.wss = null;
    }
  }

  public isConnected(): boolean {
    if (this.isClientMode) {
      return this.clientWs !== null && this.clientWs.readyState === WebSocket.OPEN;
    }
    return this.activeSockets.size > 0;
  }

  public async waitForSocket(timeoutMs = 5000): Promise<WebSocket> {
    if (this.isClientMode && this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
      return this.clientWs;
    }

    const existing = this.getPrimarySocket();
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'No active Chrome Extension connected within timeout. Please ensure Google Chrome is open with the Antigravity Browser Bridge extension enabled.'
          )
        );
      }, timeoutMs);

      const checkInterval = setInterval(() => {
        if (this.isClientMode && this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
          cleanup();
          resolve(this.clientWs);
          return;
        }

        const socket = this.getPrimarySocket();
        if (socket) {
          cleanup();
          resolve(socket);
        }
      }, 150);

      const cleanup = () => {
        clearTimeout(timer);
        clearInterval(checkInterval);
      };
    });
  }

  public async sendRequest<T = any>(
    type: BridgeMessageType,
    payload?: any,
    timeoutMs?: number
  ): Promise<T> {
    const socket = await this.waitForSocket(Math.min(timeoutMs ?? 5000, 6000));

    const id = randomUUID();
    const message: BridgeMessage = { id, type, payload };
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout (${timeout}ms) waiting for response from Chrome Extension for ${type}`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        socket.send(JSON.stringify(message));
      } catch (sendErr) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new Error(`Failed to send message to Chrome Extension: ${sendErr}`));
      }
    });
  }

  private getPrimarySocket(): WebSocket | null {
    if (this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
      return this.clientWs;
    }

    for (const ws of this.activeSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
    }
    return null;
  }

  private handleIncomingMessage(raw: string): void {
    try {
      const response: BridgeResponse = JSON.parse(raw);
      if (!response.id) return;

      const pending = this.pendingRequests.get(response.id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(response.id);

      if (response.success) {
        pending.resolve(response.data);
      } else {
        pending.reject(new Error(response.error || 'Unknown error from Chrome extension'));
      }
    } catch {
      // Ignore parse errors on broadcast
    }
  }
}
