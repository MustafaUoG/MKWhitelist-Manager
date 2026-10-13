const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell } = require('electron');
const path = require('node:path');
const settings = require('./settings');
const database = require('./database');
const pluginConfig = require('./pluginConfig');
const profiles = require('./profiles');

// The Windows installer launches the app briefly to create/remove shortcuts. This handles that and exits.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const TITLE_BAR_HEIGHT = 32;
// Colours behind the native minimise/maximise/close buttons. Keep in step with --bg-frame in theme.css.
const TITLE_BAR_COLORS = {
  dark: { color: '#1e1f22', symbolColor: '#b5bac1' },
  light: { color: '#e3e5e8', symbolColor: '#4e5058' },
};

let mainWindow = null;

function createWindow() {
  const { theme } = settings.load();
  nativeTheme.themeSource = theme;

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 680,
    minWidth: 780,
    minHeight: 520,
    show: false,
    backgroundColor: TITLE_BAR_COLORS[theme].color,
    icon: path.join(__dirname, '../../assets/icon.png'),
    // Hides the standard title bar so the page can draw its own, but keeps the native window buttons
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLE_BAR_COLORS[theme], height: TITLE_BAR_HEIGHT },
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The theme goes in the URL so the page can apply it before its first paint (no flash of the wrong theme)
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
    query: { theme, platform: process.platform },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // This window only ever shows the app's own page
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (!app.isPackaged) {
    // There's no menu bar, so give developers the usual shortcuts back
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return;
      }
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools();
      } else if (input.key === 'F5') {
        mainWindow.webContents.reload();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Registers an IPC handler whose result always reaches the page as { ok: true, ...result }
// or { ok: false, error }, so the page never has to deal with a rejected promise
function handle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!mainWindow || event.sender !== mainWindow.webContents) {
        throw new Error('Request came from an unknown window.');
      }
      return { ok: true, ...(await handler(...args)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}

function requireDbPath() {
  const { dbPath } = settings.load();
  if (!dbPath) {
    throw new Error('No database has been selected yet.');
  }
  return dbPath;
}

// Requests from the page are checked rather than trusted
function toStrings(values) {
  return Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [];
}

function registerIpcHandlers() {
  handle('app:get-state', () => {
    return { ...settings.load(), version: app.getVersion() };
  });

  handle('database:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select your linked_accounts.db file',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const dbPath = result.filePaths[0];
    database.validate(dbPath);
    settings.save({ dbPath });
    return { canceled: false, dbPath };
  });

  handle('database:show-in-folder', () => {
    shell.showItemInFolder(requireDbPath());
  });

  handle('accounts:list', () => {
    return { accounts: database.listAccounts(requireDbPath()) };
  });

  handle('accounts:unlink', (minecraftUuid) => {
    if (typeof minecraftUuid !== 'string') {
      throw new Error('Invalid Minecraft UUID.');
    }
    return { removed: database.unlinkAccount(requireDbPath(), minecraftUuid) };
  });

  // Both profile handlers answer with nothing when lookups are switched off, so the app stays offline
  handle('profiles:cached', (uuids) => {
    return { profiles: settings.load().lookupProfiles ? profiles.cached(toStrings(uuids)) : {} };
  });

  handle('profiles:lookup', async (uuids) => {
    if (!settings.load().lookupProfiles) {
      return { profiles: {}, rateLimited: false };
    }
    return profiles.lookup(toStrings(uuids));
  });

  handle('profiles:set-enabled', (enabled) => {
    settings.save({ lookupProfiles: enabled === true });
  });

  handle('config:read', () => {
    return pluginConfig.readDiscordSettings(requireDbPath());
  });

  handle('config:save', (values) => {
    const cleaned = {
      botToken: String(values?.botToken ?? '').trim(),
      guildId: String(values?.guildId ?? '').trim(),
    };

    const fieldErrors = pluginConfig.validateDiscordSettings(cleaned);
    if (Object.keys(fieldErrors).length > 0) {
      return { saved: false, fieldErrors };
    }

    pluginConfig.saveDiscordSettings(requireDbPath(), cleaned);
    return { saved: true, ...cleaned };
  });

  handle('theme:set', (theme) => {
    if (theme !== 'dark' && theme !== 'light') {
      throw new Error('Unknown theme.');
    }
    settings.save({ theme });
    nativeTheme.themeSource = theme;
    mainWindow.setBackgroundColor(TITLE_BAR_COLORS[theme].color);
    mainWindow.setTitleBarOverlay({ ...TITLE_BAR_COLORS[theme], height: TITLE_BAR_HEIGHT });
  });

  handle('clipboard:write', (text) => {
    clipboard.writeText(String(text));
  });
}

// Opening the app a second time just brings the existing window forward
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
