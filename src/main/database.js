const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

// Opens the database for one piece of work and closes it straight after, so the app never
// sits on a lock while the Minecraft server is using the same file
function withDatabase(dbPath, options, work) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  let db;
  try {
    db = new DatabaseSync(dbPath, options);
    // If the server is mid-write, wait a moment instead of failing immediately
    db.exec('PRAGMA busy_timeout = 3000');
    return work(db);
  } catch (error) {
    throw new Error(describeError(error));
  } finally {
    if (db) {
      db.close();
    }
  }
}

function describeError(error) {
  if (error.message.includes('not a database')) {
    return 'That file is not an SQLite database.';
  }
  if (error.message.includes('no such table')) {
    return 'That database has no linked_accounts table, so it is not an MKWhitelist database.';
  }
  if (error.message.includes('database is locked')) {
    return 'The database is busy. Try again in a moment.';
  }
  return error.message;
}

function listAccounts(dbPath) {
  return withDatabase(dbPath, { readOnly: true }, (db) => {
    const rows = db.prepare('SELECT minecraft_uuid, discord_id FROM linked_accounts ORDER BY rowid').all();
    return rows.map((row) => ({ minecraftUuid: row.minecraft_uuid, discordId: row.discord_id }));
  });
}

// Returns true if the account was linked (and is now unlinked)
function unlinkAccount(dbPath, minecraftUuid) {
  return withDatabase(dbPath, {}, (db) => {
    const result = db.prepare('DELETE FROM linked_accounts WHERE minecraft_uuid = ?').run(minecraftUuid);
    return result.changes > 0;
  });
}

// Throws if the file can't be used as an MKWhitelist database
function validate(dbPath) {
  listAccounts(dbPath);
}

module.exports = { listAccounts, unlinkAccount, validate };
