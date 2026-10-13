const { contextBridge, ipcRenderer } = require('electron');

// The page has no access to Node or Electron. These functions are the only things it can ask the app to do.
// Every one resolves to { ok: true, ...result } or { ok: false, error }.
contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  chooseDatabase: () => ipcRenderer.invoke('database:choose'),
  showDatabaseInFolder: () => ipcRenderer.invoke('database:show-in-folder'),
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  unlinkAccount: (minecraftUuid) => ipcRenderer.invoke('accounts:unlink', minecraftUuid),
  getCachedProfiles: (uuids) => ipcRenderer.invoke('profiles:cached', uuids),
  lookupProfiles: (uuids) => ipcRenderer.invoke('profiles:lookup', uuids),
  setProfileLookups: (enabled) => ipcRenderer.invoke('profiles:set-enabled', enabled),
  readConfig: () => ipcRenderer.invoke('config:read'),
  saveConfig: (values) => ipcRenderer.invoke('config:save', values),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
});
