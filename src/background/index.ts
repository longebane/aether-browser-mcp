import {
  BridgeMessage,
  BridgeResponse,
  DOMSnapshot,
  NavigationOptions,
  ScreenshotOptions,
  ScreenshotResult,
  TabInfo
} from '../types/index.js';

const NATIVE_HOST_NAME = 'com.antigravity.browser_bridge';
const WS_BRIDGE_URL = 'ws://127.0.0.1:18888';
const AGENT_TAB_GROUP_TITLE = '⚡ Aether Agent';

let nativePort: chrome.runtime.Port | null = null;
let wsClient: WebSocket | null = null;
let wsReconnectTimeout: NodeJS.Timeout | null = null;
let lastAgentTabId: number | null = null;
let lastAgentGroupId: number | null = null;

function connectWebSocketBridge(): void {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    wsClient = new WebSocket(WS_BRIDGE_URL);

    wsClient.onopen = () => {
      if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout);
        wsReconnectTimeout = null;
      }
    };

    wsClient.onmessage = async (event) => {
      try {
        const msg: BridgeMessage = JSON.parse(event.data);
        const response = await handleBridgeRequest(msg);
        wsClient?.send(JSON.stringify(response));
      } catch (err) {
        console.error('[Aether Bridge] Failed to process message:', err);
      }
    };

    wsClient.onclose = () => {
      wsClient = null;
      scheduleWsReconnect();
    };

    wsClient.onerror = () => {
      wsClient?.close();
    };
  } catch {
    scheduleWsReconnect();
  }
}

function scheduleWsReconnect(): void {
  if (!wsReconnectTimeout) {
    wsReconnectTimeout = setTimeout(() => {
      wsReconnectTimeout = null;
      connectWebSocketBridge();
    }, 1500);
  }
}

function connectNativeHost(): void {
  try {
    if (typeof chrome.runtime.connectNative !== 'function') return;

    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    nativePort.onMessage.addListener(async (msg: BridgeMessage) => {
      const response = await handleBridgeRequest(msg);
      nativePort?.postMessage(response);
    });

    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
      setTimeout(connectNativeHost, 5000);
    });
  } catch (err) {
    console.warn('[Aether Bridge] Native host unavailable:', err);
  }
}

async function getSavedAgentGroupId(): Promise<number | null> {
  try {
    if (typeof chrome.storage?.local !== 'undefined') {
      const data = await chrome.storage.local.get('agentGroupId');
      return typeof data.agentGroupId === 'number' ? data.agentGroupId : null;
    }
  } catch {}
  return null;
}

async function setSavedAgentGroupId(id: number | null): Promise<void> {
  lastAgentGroupId = id;
  try {
    if (typeof chrome.storage?.local !== 'undefined') {
      if (id === null) {
        await chrome.storage.local.remove('agentGroupId');
      } else {
        await chrome.storage.local.set({ agentGroupId: id });
      }
    }
  } catch {}
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs && tabs.length > 0 && tabs[0].id) {
    return tabs[0];
  }
  const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTabs && currentTabs.length > 0 && currentTabs[0].id) {
    return currentTabs[0];
  }
  const allActive = await chrome.tabs.query({ active: true });
  if (allActive && allActive.length > 0 && allActive[0].id) {
    return allActive[0];
  }
  throw new Error('No active browser tab found');
}

async function findExistingAgentGroup(preferredWindowId?: number): Promise<chrome.tabGroups.TabGroup | null> {
  if (typeof chrome.tabGroups === 'undefined' || !chrome.tabGroups.query) return null;

  try {
    const allGroups = await chrome.tabGroups.query({});
    if (!allGroups || allGroups.length === 0) {
      await setSavedAgentGroupId(null);
      return null;
    }

    const isAgentGroup = (g: chrome.tabGroups.TabGroup) => {
      const t = (g.title || '').toLowerCase().trim();
      return (
        t.includes('aether') ||
        t.includes('antigravity') ||
        t.includes('agent') ||
        t === '⚡ aether agent' ||
        t === '⚡ antigravity agent'
      );
    };

    // 1. Check saved group ID from storage or memory
    const savedId = lastAgentGroupId ?? await getSavedAgentGroupId();
    if (savedId !== null) {
      const byId = allGroups.find((g) => g.id === savedId);
      if (byId) {
        const tabs = await chrome.tabs.query({ groupId: byId.id });
        if (tabs && tabs.length > 0) {
          lastAgentGroupId = byId.id;
          return byId;
        }
      }
    }

    // 2. Try window match in preferred window
    if (preferredWindowId) {
      const windowMatch = allGroups.find((g) => g.windowId === preferredWindowId && isAgentGroup(g));
      if (windowMatch) {
        const tabs = await chrome.tabs.query({ groupId: windowMatch.id });
        if (tabs && tabs.length > 0) {
          await setSavedAgentGroupId(windowMatch.id);
          return windowMatch;
        }
      }
    }

    // 3. Match any agent group that actually has tabs
    const matchingGroups = allGroups.filter(isAgentGroup);
    for (const group of matchingGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      if (tabs && tabs.length > 0) {
        await setSavedAgentGroupId(group.id);
        return group;
      }
    }
  } catch (err) {
    console.warn('[Aether Bridge] Tab group query failed:', err);
  }

  return null;
}

async function getOrCreateAgentTab(
  url: string,
  makeActive = false,
  forceNewTab = false,
  customGroupTitle?: string
): Promise<chrome.tabs.Tab> {
  const groupTitle = customGroupTitle || AGENT_TAB_GROUP_TITLE;

  let targetWindowId: number | undefined;
  try {
    const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    targetWindowId = focused?.windowId;
  } catch {}

  const agentGroup = await findExistingAgentGroup(targetWindowId);
  // Guarantee new tab is created in the same window as the group, or the target window
  const windowId = agentGroup ? agentGroup.windowId : targetWindowId;

  // 1. If agent group exists and we are not forcing a new tab, reuse existing tab in that group
  if (agentGroup && !forceNewTab) {
    try {
      const groupTabs = await chrome.tabs.query({ groupId: agentGroup.id });
      if (groupTabs && groupTabs.length > 0) {
        const targetTab = groupTabs.find((t) => t.active) || groupTabs[0];
        const updateOpts: chrome.tabs.UpdateProperties = { url };
        if (makeActive) {
          updateOpts.active = true;
        }
        const updated = await chrome.tabs.update(targetTab.id!, updateOpts);
        lastAgentTabId = updated.id!;
        await setSavedAgentGroupId(agentGroup.id);
        return updated;
      }
    } catch {}
  }

  // 2. Create a new tab (in background by default)
  const createOpts: chrome.tabs.CreateProperties = {
    url,
    active: makeActive
  };
  if (windowId) createOpts.windowId = windowId;

  const newTab = await chrome.tabs.create(createOpts);
  lastAgentTabId = newTab.id!;

  // 3. Group tab into existing or new Agent Tab Group
  if (typeof chrome.tabs.group === 'function' && newTab.id) {
    try {
      let groupId: number;
      if (agentGroup) {
        try {
          groupId = await chrome.tabs.group({
            tabIds: [newTab.id],
            groupId: agentGroup.id
          });
        } catch {
          // Fallback if group was disbanded
          groupId = await chrome.tabs.group({ tabIds: [newTab.id] });
        }
      } else {
        groupId = await chrome.tabs.group({ tabIds: [newTab.id] });
      }

      lastAgentGroupId = groupId;
      await setSavedAgentGroupId(groupId);

      if (typeof chrome.tabGroups !== 'undefined' && chrome.tabGroups.update) {
        await chrome.tabGroups.update(groupId, {
          title: groupTitle,
          color: 'cyan',
          collapsed: false
        });
      }
    } catch (groupErr) {
      console.warn('[Aether Bridge] Grouping tab failed:', groupErr);
    }
  }

  return newTab;
}

async function resolveTargetTab(requestedTabId?: number): Promise<chrome.tabs.Tab> {
  if (requestedTabId) {
    try {
      const tab = await chrome.tabs.get(requestedTabId);
      if (tab) return tab;
    } catch {}
  }

  if (lastAgentTabId) {
    try {
      const tab = await chrome.tabs.get(lastAgentTabId);
      if (tab && !tab.discarded) return tab;
    } catch {
      lastAgentTabId = null;
    }
  }

  // Check if an agent group exists with tabs in the background
  const agentGroup = await findExistingAgentGroup();
  if (agentGroup) {
    try {
      const groupTabs = await chrome.tabs.query({ groupId: agentGroup.id });
      if (groupTabs && groupTabs.length > 0) {
        const targetTab = groupTabs.find((t) => t.active) || groupTabs[0];
        lastAgentTabId = targetTab.id!;
        return targetTab;
      }
    } catch {}
  }

  return await getActiveTab();
}

async function ensureContentScriptInjected(tabId: number): Promise<void> {
  try {
    const pingResp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (pingResp?.data?.status === 'ok') {
      return;
    }
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (injectErr) {
      throw new Error(`Failed to inject content script into tab ${tabId}: ${injectErr}`);
    }
  }
}

async function handleBridgeRequest(msg: BridgeMessage): Promise<BridgeResponse> {
  try {
    if (msg.type === 'STATUS') {
      return {
        id: msg.id || 'status',
        success: true,
        data: {
          nativeConnected: nativePort !== null,
          wsConnected: wsClient !== null && wsClient.readyState === WebSocket.OPEN,
          version: '0.1.0'
        }
      };
    }

    if (msg.type === 'GET_TAB_INFO') {
      const tab = await resolveTargetTab((msg.payload as any)?.tabId);
      const tabInfo: TabInfo = {
        tabId: tab.id!,
        url: tab.url || '',
        title: tab.title || '',
        status: tab.status,
        active: tab.active
      };
      return {
        id: msg.id,
        success: true,
        data: tabInfo
      };
    }

    if (msg.type === 'NAVIGATE') {
      const payload = msg.payload as NavigationOptions;
      if (!payload || !payload.url) {
        throw new Error('Navigation requires target URL');
      }

      let tab: chrome.tabs.Tab;

      if (payload.actUponCurrentTab || payload.useCurrentTab) {
        const currentActive = await getActiveTab();
        const updateOpts: chrome.tabs.UpdateProperties = { url: payload.url };
        if (payload.active) {
          updateOpts.active = true;
        }
        tab = await chrome.tabs.update(currentActive.id!, updateOpts);
        lastAgentTabId = tab.id!;
      } else {
        tab = await getOrCreateAgentTab(
          payload.url,
          payload.active ?? false,
          payload.newTab ?? false,
          payload.groupTitle
        );
      }

      await waitForTabComplete(tab.id!);
      await ensureContentScriptInjected(tab.id!);

      return {
        id: msg.id,
        success: true,
        data: {
          tabId: tab.id,
          url: payload.url,
          status: 'navigated'
        }
      };
    }

    if (msg.type === 'CLOSE_TAB' || msg.type === 'CLEANUP_TABS') {
      const payload = (msg.payload || {}) as CloseTabOptions;
      const closedIds: number[] = [];

      if (payload.allAgentTabs || msg.type === 'CLEANUP_TABS') {
        const agentGroup = await findExistingAgentGroup();
        if (agentGroup) {
          try {
            const groupTabs = await chrome.tabs.query({ groupId: agentGroup.id });
            for (const t of groupTabs) {
              if (t.id) {
                await chrome.tabs.remove(t.id);
                closedIds.push(t.id);
              }
            }
          } catch {}
        }
        if (lastAgentTabId && !closedIds.includes(lastAgentTabId)) {
          try {
            await chrome.tabs.remove(lastAgentTabId);
            closedIds.push(lastAgentTabId);
          } catch {}
        }
        lastAgentTabId = null;
        await setSavedAgentGroupId(null);
      } else {
        const targetTab = payload.tabId
          ? await chrome.tabs.get(payload.tabId).catch(() => null)
          : await resolveTargetTab().catch(() => null);

        if (targetTab?.id) {
          await chrome.tabs.remove(targetTab.id);
          closedIds.push(targetTab.id);
          if (lastAgentTabId === targetTab.id) {
            lastAgentTabId = null;
          }
        }
      }

      let remainingCount = 0;
      const currentGroup = await findExistingAgentGroup();
      if (currentGroup) {
        try {
          const remainingTabs = await chrome.tabs.query({ groupId: currentGroup.id });
          remainingCount = remainingTabs.length;
          if (remainingCount === 0) {
            await setSavedAgentGroupId(null);
          }
        } catch {}
      }

      return {
        id: msg.id,
        success: true,
        data: {
          closedTabIds: closedIds,
          remainingAgentTabs: remainingCount
        }
      };
    }

    if (msg.type === 'CAPTURE_VIEWPORT') {
      const tab = await resolveTargetTab((msg.payload as any)?.tabId);
      const options = (msg.payload || {}) as ScreenshotOptions;
      const format = options.format === 'jpeg' ? 'jpeg' : 'png';
      const quality = format === 'jpeg' ? (options.quality ?? 80) : undefined;

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format,
        quality
      });

      const result: ScreenshotResult = {
        dataUrl,
        mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
        width: tab.width,
        height: tab.height
      };

      return {
        id: msg.id,
        success: true,
        data: result
      };
    }

    const targetTab = (msg.payload as any)?.inspectActive
      ? await getActiveTab()
      : await resolveTargetTab((msg.payload as any)?.tabId);

    const tabId = targetTab.id!;
    await ensureContentScriptInjected(tabId);

    const response: BridgeResponse = await chrome.tabs.sendMessage(tabId, msg);
    return response;
  } catch (err: any) {
    return {
      id: msg.id,
      success: false,
      error: err?.message || String(err)
    };
  }
}

function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(listener);
  });
}

chrome.runtime.onMessage.addListener((message: BridgeMessage, _sender, sendResponse: (res: BridgeResponse) => void) => {
  if (message.type === 'STATUS') {
    sendResponse({
      id: message.id || 'status',
      success: true,
      data: {
        nativeConnected: nativePort !== null,
        wsConnected: wsClient !== null && wsClient.readyState === WebSocket.OPEN,
        version: '0.1.0'
      }
    });
    return true;
  }

  handleBridgeRequest(message).then(sendResponse);
  return true;
});

(globalThis as any).connect = connectWebSocketBridge;
(globalThis as any).__bridge = {
  connect: connectWebSocketBridge,
  get ws() { return wsClient; },
  get nativePort() { return nativePort; },
  get lastAgentTabId() { return lastAgentTabId; },
  get lastAgentGroupId() { return lastAgentGroupId; }
};

if (typeof chrome.alarms !== 'undefined') {
  chrome.alarms.create('bridge_keepalive', { periodInMinutes: 0.25 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'bridge_keepalive') {
      connectWebSocketBridge();
    }
  });
}

chrome.tabs.onActivated.addListener(() => {
  connectWebSocketBridge();
});

chrome.windows.onFocusChanged.addListener(() => {
  connectWebSocketBridge();
});

connectWebSocketBridge();
connectNativeHost();
