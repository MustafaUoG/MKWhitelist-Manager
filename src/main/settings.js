const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { dbPath: null, theme: 'dark', lookupProfiles: true, meowUnlocked: false };

// Lives in the per-user app data folder, so it works no matter where the app is launched from
function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function load() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    // No settings yet (first launch) or the file is unreadable, either way start from the defaults
  }

  return {
    dbPath: typeof saved.dbPath === 'string' ? saved.dbPath : DEFAULTS.dbPath,
    theme: saved.theme === 'light' ? 'light' : DEFAULTS.theme,
    lookupProfiles: typeof saved.lookupProfiles === 'boolean' ? saved.lookupProfiles : DEFAULTS.lookupProfiles,
    meowUnlocked: typeof saved.meowUnlocked === 'boolean' ? saved.meowUnlocked : DEFAULTS.meowUnlocked,
  };
}

function save(changes) {
  const settings = { ...load(), ...changes };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  return settings;
}

module.exports = { load, save };
