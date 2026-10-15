import { $, toast } from './ui.js';
import { createAccountsView } from './accounts.js';
import { createSettingsView } from './settings.js';
import { setUpMeow } from './meow.js';

const welcome = $('#welcome');
const welcomeError = $('#welcome-error');
const app = $('#app');
const dbPanel = $('#db-panel');
const accountCount = $('#account-count');

const state = await window.api.getState();

const accountsView = createAccountsView({
  lookupProfiles: state.lookupProfiles,
  onLoaded: showDatabaseStatus,
  onChooseDatabase: chooseDatabase,
});
const settingsView = createSettingsView({
  lookupProfiles: state.lookupProfiles,
  onProfileLookupsChanged: accountsView.setProfileLookups,
  onChooseDatabase: chooseDatabase,
});

// Opens the file picker. Used by the welcome screen, the Settings page and the "couldn't read" screen.
async function chooseDatabase() {
  const result = await window.api.chooseDatabase();

  welcomeError.hidden = result.ok;
  if (!result.ok) {
    // The file wasn't usable, so whatever database was open before stays open.
    // The welcome screen has room to show the reason inline. Everywhere else it's a toast.
    welcomeError.textContent = result.error;
    if (welcome.hidden) {
      toast(result.error, 'error');
    }
    return;
  }

  if (!result.canceled) {
    openDatabase(result.dbPath);
  }
}

function openDatabase(dbPath) {
  welcome.hidden = true;
  app.hidden = false;

  // Show the file name on one line and the last two folders under it, e.g. "linked_accounts.db" / "plugins\MKWhitelist"
  const parts = dbPath.split(/[\\/]/);
  $('#db-name').textContent = parts.at(-1);
  $('#db-folder').textContent = parts.slice(-3, -1).join('\\');
  dbPanel.title = dbPath;
  $('#settings-db-path').textContent = dbPath;

  accountsView.refresh();
  settingsView.refresh();
}

function showDatabaseStatus({ ok, count }) {
  dbPanel.classList.toggle('is-error', !ok);
  $('#db-status').setAttribute('aria-label', ok ? 'Database connected' : 'Database could not be read');
  accountCount.hidden = !ok;
  accountCount.textContent = count;
}

function showView(name) {
  for (const item of document.querySelectorAll('.nav-item[data-view]')) {
    const active = item.dataset.view === name;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
  }
  for (const view of document.querySelectorAll('.view')) {
    view.hidden = view.id !== `view-${name}`;
  }
}

for (const item of document.querySelectorAll('.nav-item[data-view]')) {
  item.addEventListener('click', () => showView(item.dataset.view));
}

$('#welcome-choose').addEventListener('click', chooseDatabase);
$('#db-show').addEventListener('click', () => window.api.showDatabaseInFolder());

setUpMeow({ unlocked: state.meowUnlocked });

$('#app-version').textContent = `MKWhitelist Manager ${state.version}`;

if (state.dbPath) {
  openDatabase(state.dbPath);
} else {
  welcome.hidden = false;
}
