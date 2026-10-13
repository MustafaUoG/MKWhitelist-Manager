const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const BOT_TOKEN_PATH = ['discord', 'bot-token'];
const GUILD_ID_PATH = ['discord', 'guild-id'];

// The placeholder values the plugin ships in its default config.yml
const PLACEHOLDER_BOT_TOKEN = 'PASTE_YOUR_BOT_TOKEN_HERE';
const PLACEHOLDER_GUILD_ID = 'PASTE_YOUR_DISCORD_SERVER_ID_HERE';

// The plugin keeps config.yml in the same folder as linked_accounts.db (plugins/MKWhitelist)
function configPathFor(dbPath) {
  return path.join(path.dirname(dbPath), 'config.yml');
}

function parse(configPath) {
  // intAsBigInt keeps an unquoted guild ID exact. As a normal number its last digits would be rounded off.
  const doc = YAML.parseDocument(fs.readFileSync(configPath, 'utf8'), { intAsBigInt: true });
  if (doc.errors.length > 0) {
    throw new Error(`config.yml has a syntax error: ${doc.errors[0].message}`);
  }
  return doc;
}

function readText(doc, keyPath) {
  const value = doc.getIn(keyPath);
  return value == null ? '' : String(value);
}

// Changes the value in place where it can, so a comment on the same line is kept
function writeText(doc, keyPath, text) {
  const existing = doc.getIn(keyPath, true);
  const scalar = YAML.isScalar(existing) ? existing : new YAML.Scalar(text);
  scalar.value = text;
  // Always double-quoted, like the plugin's default config, so an ID is never read back as a number
  scalar.type = YAML.Scalar.QUOTE_DOUBLE;
  if (scalar !== existing) {
    doc.setIn(keyPath, scalar);
  }
}

function readDiscordSettings(dbPath) {
  const configPath = configPathFor(dbPath);
  if (!fs.existsSync(configPath)) {
    return { exists: false, configPath, botToken: '', guildId: '' };
  }

  const doc = parse(configPath);
  return {
    exists: true,
    configPath,
    botToken: readText(doc, BOT_TOKEN_PATH),
    guildId: readText(doc, GUILD_ID_PATH),
  };
}

// Mirrors the checks the plugin runs on startup, so a bad value is caught here instead of in the server log
function validateDiscordSettings({ botToken, guildId }) {
  const fieldErrors = {};

  if (botToken === '') {
    fieldErrors.botToken = 'Enter your bot token.';
  } else if (botToken === PLACEHOLDER_BOT_TOKEN) {
    fieldErrors.botToken = 'This is still the placeholder. Paste your real bot token.';
  }

  if (guildId === '') {
    fieldErrors.guildId = 'Enter your Discord server ID.';
  } else if (guildId === PLACEHOLDER_GUILD_ID) {
    fieldErrors.guildId = 'This is still the placeholder. Paste your real server ID.';
  } else if (!/^\d+$/.test(guildId)) {
    fieldErrors.guildId = 'A server ID is only digits. Right-click your server icon in Discord (with Developer Mode on) and choose Copy Server ID.';
  }

  return fieldErrors;
}

function saveDiscordSettings(dbPath, { botToken, guildId }) {
  const configPath = configPathFor(dbPath);
  if (!fs.existsSync(configPath)) {
    throw new Error(`config.yml was not found at ${configPath}`);
  }

  const doc = parse(configPath);
  writeText(doc, BOT_TOKEN_PATH, botToken);
  writeText(doc, GUILD_ID_PATH, guildId);
  fs.writeFileSync(configPath, doc.toString());
}

module.exports = { readDiscordSettings, validateDiscordSettings, saveDiscordSettings };
