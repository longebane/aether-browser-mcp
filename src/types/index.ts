export interface DOMSerializerOptions {
  maxDepth?: number;
  viewportOnly?: boolean;
  maxTextLength?: number;
  filterHidden?: boolean;
  compactLists?: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteractiveElementInfo {
  id: number;
  tag: string;
  role?: string;
  text?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
  inViewport: boolean;
  rect?: BoundingBox;
}

export interface DOMSnapshot {
  url: string;
  title: string;
  markdown: string;
  elementCount: number;
  interactiveCount: number;
  estimatedTokens: number;
  timestamp: number;
}

export type ActionType = 
  | 'click' 
  | 'type' 
  | 'select' 
  | 'scroll' 
  | 'hover' 
  | 'press_key' 
  | 'focus'
  | 'clear';

export interface BrowserAction {
  action: ActionType;
  elementId?: number;
  text?: string;
  value?: string;
  clearExisting?: boolean;
  pressEnter?: boolean;
  key?: string;
  scrollDirection?: 'up' | 'down' | 'top' | 'bottom';
  scrollAmount?: number;
  scrollDelta?: { x: number; y: number };
}

export interface ActionResult {
  success: boolean;
  action: ActionType;
  elementId?: number;
  error?: string;
  details?: string;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScreenshotResult {
  dataUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface NavigationOptions {
  url: string;
  newTab?: boolean;
  active?: boolean;
  actUponCurrentTab?: boolean;
  useCurrentTab?: boolean;
  groupTitle?: string;
}

export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  status?: string;
  active?: boolean;
}

export interface BrowserStatus {
  connected: boolean;
  activeTab?: TabInfo;
  bridgePort?: number;
  version: string;
}

export type BridgeMessageType = 
  | 'GET_DOM_SNAPSHOT'
  | 'EXECUTE_ACTION'
  | 'GET_TAB_INFO'
  | 'CAPTURE_VIEWPORT'
  | 'NAVIGATE'
  | 'PING'
  | 'STATUS';

export interface BridgeMessage<T = unknown> {
  id: string;
  type: BridgeMessageType;
  payload?: T;
}

export interface BridgeResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}
