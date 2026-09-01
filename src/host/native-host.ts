import { WebSocket } from 'ws';

const WS_URL = 'ws://127.0.0.1:18888';

/**
 * Chrome Native Messaging Host Protocol Handler
 * Format: 32-bit uint length (little endian) followed by UTF-8 JSON payload
 */
class NativeHost {
  private ws: WebSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);

  constructor() {
    this.setupStdIO();
    this.connectBridge();
  }

  private connectBridge(): void {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        // Connected to local bridge
      });

      this.ws.on('message', (data: Buffer | string) => {
        // Forward message from MCP to Chrome Extension
        this.sendToChrome(JSON.parse(data.toString()));
      });

      this.ws.on('close', () => {
        this.ws = null;
        setTimeout(() => this.connectBridge(), 2000);
      });

      this.ws.on('error', () => {
        this.ws?.close();
      });
    } catch {
      setTimeout(() => this.connectBridge(), 2000);
    }
  }

  private setupStdIO(): void {
    process.stdin.on('readable', () => {
      let chunk: Buffer | null;
      while ((chunk = process.stdin.read()) !== null) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.processBuffer();
      }
    });

    process.stdin.on('end', () => {
      process.exit(0);
    });
  }

  private processBuffer(): void {
    while (this.buffer.length >= 4) {
      const msgLen = this.buffer.readUInt32LE(0);
      if (this.buffer.length < 4 + msgLen) {
        // Wait for full message
        break;
      }

      const msgBuffer = this.buffer.subarray(4, 4 + msgLen);
      this.buffer = this.buffer.subarray(4 + msgLen);

      try {
        const jsonStr = msgBuffer.toString('utf-8');
        const message = JSON.parse(jsonStr);
        this.handleChromeMessage(message);
      } catch (err) {
        console.error('[NativeHost] Failed to parse message:', err);
      }
    }
  }

  private handleChromeMessage(message: any): void {
    // Forward message from Chrome to MCP Server via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public sendToChrome(message: any): void {
    const jsonStr = JSON.stringify(message);
    const msgBuffer = Buffer.from(jsonStr, 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(msgBuffer.length, 0);

    process.stdout.write(Buffer.concat([header, msgBuffer]));
  }
}

// Start host
new NativeHost();
