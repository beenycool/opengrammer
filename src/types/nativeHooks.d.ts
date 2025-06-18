/**
 * TypeScript definitions for native OS hooks and accessibility APIs
 * These types define the interfaces for cross-platform text field detection
 */

export interface WindowsUIAutomationElement {
  automationId: string;
  name: string;
  className: string;
  controlType: string;
  boundingRectangle: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  value: string;
  processId: number;
  hasKeyboardFocus: boolean;
}

export interface MacOSAccessibilityElement {
  axRole: string;
  axValue: string;
  axTitle: string;
  axFrame: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  axFocused: boolean;
  axApplication: string;
  axIdentifier?: string;
}

export interface LinuxATSPIElement {
  role: string;
  name: string;
  value: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  focused: boolean;
  application: string;
  accessible_id?: string;
}

export interface NativeKeyboardEvent {
  keyCode: number;
  scanCode: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  type: 'keydown' | 'keyup' | 'keypress';
  timestamp: number;
  target?: {
    elementId: string;
    application: string;
  };
}

export interface NativeMouseEvent {
  x: number;
  y: number;
  button: 'left' | 'right' | 'middle' | 'x1' | 'x2';
  type: 'mousedown' | 'mouseup' | 'mousemove' | 'click' | 'dblclick';
  timestamp: number;
  target?: {
    elementId: string;
    application: string;
  };
}

export interface NativeFocusEvent {
  elementId: string;
  application: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'focus' | 'blur';
  timestamp: number;
  element: WindowsUIAutomationElement | MacOSAccessibilityElement | LinuxATSPIElement;
}

export interface NativeTextChangeEvent {
  elementId: string;
  application: string;
  oldText: string;
  newText: string;
  selectionStart: number;
  selectionEnd: number;
  timestamp: number;
}

export interface NativeHookCallbacks {
  onKeyboardEvent?: (event: NativeKeyboardEvent) => void;
  onMouseEvent?: (event: NativeMouseEvent) => void;
  onFocusEvent?: (event: NativeFocusEvent) => void;
  onTextChangeEvent?: (event: NativeTextChangeEvent) => void;
}

export interface PlatformHook {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  setCallbacks(callbacks: NativeHookCallbacks): void;
  isSupported(): boolean;
  getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermissions(): Promise<boolean>;
}

export interface WindowsHook extends PlatformHook {
  setupUIAutomation(): Promise<void>;
  setupKeyboardHook(): Promise<void>;
  setupMouseHook(): Promise<void>;
  getUIAutomationElements(): Promise<WindowsUIAutomationElement[]>;
}

export interface MacOSHook extends PlatformHook {
  setupAccessibilityAPI(): Promise<void>;
  setupGlobalEventMonitoring(): Promise<void>;
  getAccessibilityElements(): Promise<MacOSAccessibilityElement[]>;
  checkTrustedAccessibilityClient(): Promise<boolean>;
}

export interface LinuxHook extends PlatformHook {
  setupATSPI(): Promise<void>;
  setupX11EventMonitoring(): Promise<void>;
  setupWaylandEventMonitoring(): Promise<void>;
  getATSPIElements(): Promise<LinuxATSPIElement[]>;
  detectDisplayServer(): 'x11' | 'wayland' | 'unknown';
}

export interface NativeHookFactory {
  createPlatformHook(): PlatformHook;
  getSupportedPlatforms(): string[];
  getCurrentPlatform(): string;
}

export interface OverlayWindowOptions {
  width: number;
  height: number;
  x: number;
  y: number;
  alwaysOnTop: boolean;
  transparent: boolean;
  frame: boolean;
  resizable: boolean;
  focusable: boolean;
  skipTaskbar: boolean;
  ignoreMouseEvents: boolean;
}

export interface OverlayContent {
  html: string;
  css?: string;
  javascript?: string;
}

export interface NativeOverlayManager {
  createOverlay(options: OverlayWindowOptions, content: OverlayContent): Promise<string>;
  updateOverlay(overlayId: string, content: OverlayContent): Promise<void>;
  moveOverlay(overlayId: string, x: number, y: number): Promise<void>;
  resizeOverlay(overlayId: string, width: number, height: number): Promise<void>;
  showOverlay(overlayId: string): Promise<void>;
  hideOverlay(overlayId: string): Promise<void>;
  destroyOverlay(overlayId: string): Promise<void>;
  listOverlays(): string[];
}

export interface AccessibilityPermissions {
  checkPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'>;
  openSystemPreferences?(): Promise<void>;
}

export interface SystemInfo {
  platform: 'windows' | 'macos' | 'linux';
  version: string;
  architecture: string;
  displayServer?: 'x11' | 'wayland';
  accessibilitySupported: boolean;
  electronVersion?: string;
}

// Platform-specific module declarations
declare module 'node-windows-accessibility' {
  export function initializeUIAutomation(): Promise<void>;
  export function getTextElements(): Promise<WindowsUIAutomationElement[]>;
  export function setupKeyboardHook(callback: (event: NativeKeyboardEvent) => void): void;
  export function cleanup(): Promise<void>;
}

declare module 'node-macos-accessibility' {
  export function checkPermissions(): Promise<boolean>;
  export function requestPermissions(): Promise<boolean>;
  export function getAccessibilityElements(): Promise<MacOSAccessibilityElement[]>;
  export function setupEventMonitoring(callbacks: NativeHookCallbacks): void;
  export function cleanup(): Promise<void>;
}

declare module 'node-linux-accessibility' {
  export function initializeATSPI(): Promise<void>;
  export function getTextElements(): Promise<LinuxATSPIElement[]>;
  export function setupEventMonitoring(callbacks: NativeHookCallbacks): void;
  export function detectDisplayServer(): 'x11' | 'wayland' | 'unknown';
  export function cleanup(): Promise<void>;
}