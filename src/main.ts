/**
 * Main application entry point demonstrating overlay service initialization
 * This file shows how to integrate the overlay service with an Electron app
 */

import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { OverlayService, createOverlayService } from './overlayService';
import { checkGrammar } from './grammarEngine';
import { DictionaryStore } from './dictionaryStore';
import { SettingsService } from './settingsService';

class OpenGrammerApp {
  private overlayService: OverlayService;
  private mainWindow?: BrowserWindow;
  private settingsWindow?: BrowserWindow;
  private dictionaryStore: DictionaryStore;
  private settingsService: SettingsService;

  constructor() {
    // Initialize dictionary store
    const dictionaryPath = path.join(app.getPath('userData'), 'custom-dictionary.enc');
    this.dictionaryStore = new DictionaryStore(dictionaryPath, 'opengrammer-secret-key');
    
    // Initialize settings service
    this.settingsService = new SettingsService(this.dictionaryStore);
    
    // Initialize overlay service with custom configuration
    this.overlayService = createOverlayService();
    this.setupOverlayService();
  }

  /**
   * Setup overlay service with grammar checking handlers
   */
  private setupOverlayService(): void {
    // Register grammar checking handler
    this.overlayService.registerHandler({
      onTextCapture: (event) => {
        const grammarIssues = checkGrammar(event.text);
        
        const suggestions = grammarIssues.map(issue => ({
          type: issue.type,
          message: issue.message,
          position: { x: event.position.x + (issue.column * 8), y: event.position.y },
          suggestion: issue.suggestion || undefined,
          action: 'replace' as const
        }));

        return { suggestions };
      },
      
      onFocusChange: (event) => {
        console.log(`Focus changed: ${event.type} in ${event.applicationName || 'unknown app'}`);
      }
    });

    // Listen to overlay service events
    this.overlayService.on('platform-initialized', (data) => {
      console.log(`Platform initialized: ${data.platform}`);
    });

    this.overlayService.on('overlay-created', (data) => {
      console.log(`Overlay created with ${data.suggestions} suggestions`);
    });

    this.overlayService.on('accessibility-scan-complete', (data) => {
      console.log(`Accessibility scan found ${data.elementsFound} elements`);
    });

    this.overlayService.on('overlay-error', (data) => {
      console.error('Overlay error:', data.error);
    });
  }

  /**
   * Initialize the application
   */
  public async initialize(): Promise<void> {
    await app.whenReady();
    
    try {
      // Initialize dictionary store
      await this.dictionaryStore.initialize();
      console.log('Dictionary store initialized successfully');
      
      // Start the overlay service for system-wide monitoring
      await this.overlayService.start();
      console.log('Overlay service started successfully');
      
      // Create main application window
      this.createMainWindow();
      
      // Create application menu
      this.createApplicationMenu();
      
    } catch (error) {
      console.error('Failed to start overlay service:', error);
      app.quit();
    }
  }

  /**
   * Create the main application window
   */
  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false // Don't show until ready
    });

    // Load a simple HTML page or your main app UI
    this.mainWindow.loadFile(path.join(__dirname, '../assets/index.html'));

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow!.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = undefined;
    });
  }

  /**
   * Create settings window
   */
  private createSettingsWindow(): void {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      parent: this.mainWindow,
      modal: false,
      show: false,
      title: 'OpenGrammer Settings'
    });

    // Load settings HTML page
    this.settingsWindow.loadFile(path.join(__dirname, '../assets/settings.html'));

    // Show window when ready
    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow!.show();
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = undefined;
    });
  }

  /**
   * Check for application updates
   */
  public checkForUpdates(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('Update check skipped in development mode');
      return;
    }

    autoUpdater.checkForUpdatesAndNotify();
  }

  /**
   * Create application menu with update functionality
   */
  private createApplicationMenu(): void {
    const template: any[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Settings',
            accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
            click: () => {
              this.createSettingsWindow();
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Check for Updates',
            click: () => {
              this.checkForUpdates();
            }
          },
          {
            label: 'About',
            click: async () => {
              await dialog.showMessageBox(this.mainWindow!, {
                type: 'info',
                title: 'About OpenGrammer',
                message: 'OpenGrammer',
                detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`
              });
            }
          },
          {
            label: 'Learn More',
            click: () => {
              shell.openExternal('https://github.com/yourusername/opengrammer');
            }
          }
        ]
      }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });

      // Window menu for macOS
      template.push({
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Clean shutdown of the application
   */
  public async shutdown(): Promise<void> {
    try {
      await this.overlayService.stop();
      console.log('Overlay service stopped cleanly');
      
      this.settingsService.dispose();
      console.log('Settings service disposed cleanly');
    } catch (error) {
      console.error('Error stopping services:', error);
    }
  }
}

// Application lifecycle management
let openGrammerApp: OpenGrammerApp;

// Only initialize if this file is being run directly (not imported for testing)
if (require.main === module) {
  openGrammerApp = new OpenGrammerApp();

  // Handle app ready event
  app.on('ready', async () => {
    await openGrammerApp.initialize();
  });

  // Handle app quit events
  app.on('window-all-closed', async () => {
    await openGrammerApp.shutdown();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', async () => {
    await openGrammerApp.shutdown();
  });

  // Handle macOS app activation
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await openGrammerApp.initialize();
    }
  });
}

// Export for testing
export { OpenGrammerApp };