import { DOMSerializer } from './dom-serializer.js';
import { ActionDispatcher } from './action-dispatcher.js';
import { BridgeMessage, BridgeResponse, BrowserAction, DOMSerializerOptions } from '../types/index.js';

// Initialize singleton instances
const serializer = new DOMSerializer();
const dispatcher = new ActionDispatcher(serializer);

// Expose on global window object for direct script execution or diagnostics
if (typeof window !== 'undefined') {
  (window as any).__antigravity_bridge = {
    serializer,
    dispatcher,
    version: '0.1.0'
  };
}

// Setup Chrome Runtime Message Listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: BridgeMessage, _sender, sendResponse: (response: BridgeResponse) => void) => {
    handleIncomingMessage(message)
      .then((data) => {
        sendResponse({
          id: message.id || 'anonymous',
          success: true,
          data
        });
      })
      .catch((err) => {
        sendResponse({
          id: message.id || 'anonymous',
          success: false,
          error: err?.message || String(err)
        });
      });

    // Return true to indicate asynchronous sendResponse
    return true;
  });
}

async function handleIncomingMessage(message: BridgeMessage): Promise<any> {
  switch (message.type) {
    case 'GET_DOM_SNAPSHOT': {
      const options = message.payload as DOMSerializerOptions | undefined;
      if (options) serializer.setOptions(options);
      const snapshot = serializer.serialize(document);
      return snapshot;
    }

    case 'EXECUTE_ACTION': {
      const action = message.payload as BrowserAction;
      if (!action) {
        throw new Error('Missing action payload');
      }
      const result = await dispatcher.execute(action);
      return result;
    }

    case 'PING': {
      return {
        status: 'ok',
        url: window.location.href,
        title: document.title,
        interactiveElements: serializer.getInteractiveElements().size
      };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

export { DOMSerializer, ActionDispatcher };
