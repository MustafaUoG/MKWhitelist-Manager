import { $, icon, toast, copyText } from './ui.js';
import { drawAvatar, drawFace } from './avatar.js';

// How many players are looked up with Mojang at once
const LOOKUP_BATCH_SIZE = 5;

// The Linked Accounts page. lookupProfiles says whether to show Minecraft names and skins,
// onLoaded is told how each load went, onChooseDatabase opens the file picker.
export function createAccountsView({ lookupProfiles, onLoaded, onChooseDatabase }) {
  const searchInput = $('#account-search');
  const refreshButton = $('#accounts-refresh');
  const heading = $('#accounts-heading');
  const list = $('#account-list');
  const emptyState = $('#accounts-empty');
  const noResultsState = $('#accounts-no-results');
  const errorState = $('#accounts-error');
  const unlinkDialog = $('#unlink-dialog');

  let accounts = [];
  // The account the unlink dialog is currently asking about
  let accountToUnlink = null;

  // Minecraft names and faces by UUID. Kept between refreshes, so rows don't drop back to bare UUIDs while reloading.
  const profiles = new Map();
  let profileLookupsEnabled = lookupProfiles;
  // Goes up every time a lookup starts or is cancelled, so an older one still waiting on Mojang knows to stop
  let lookupRun = 0;

  async function refresh() {
    const result = await window.api.listAccounts();

    accounts = result.ok ? result.accounts : [];
    errorState.hidden = result.ok;
    $('#accounts-error-message').textContent = result.ok ? '' : result.error;
    onLoaded({ ok: result.ok, count: accounts.length });
    render();

    // Not awaited: the list is already usable, and names fill in as they arrive
    loadProfiles();
  }

  async function loadProfiles() {
    const run = ++lookupRun;
    if (!profileLookupsEnabled) {
      return;
    }
    const uuids = accounts.map((account) => account.minecraftUuid);

    // First whatever was saved from earlier lookups, so most names appear straight away
    if (!applyProfiles(run, await window.api.getCachedProfiles(uuids))) {
      return;
    }

    // Then check with Mojang a few players at a time. Ones looked up recently are answered from the saved copy.
    for (let start = 0; start < uuids.length; start += LOOKUP_BATCH_SIZE) {
      const result = await window.api.lookupProfiles(uuids.slice(start, start + LOOKUP_BATCH_SIZE));
      if (!applyProfiles(run, result) || result.rateLimited) {
        // Rate limited means Mojang wants a break. The rest are picked up on the next refresh.
        return;
      }
    }
  }

  // Adds looked-up profiles to the list. Returns false if they belong to a lookup that has been replaced or failed.
  function applyProfiles(run, result) {
    if (run !== lookupRun || !result.ok) {
      return false;
    }

    let changed = false;
    for (const [uuid, profile] of Object.entries(result.profiles)) {
      const known = profiles.get(uuid);
      if (!known || known.name !== profile.name || known.face !== profile.face) {
        profiles.set(uuid, profile);
        changed = true;
      }
    }
    if (changed) {
      render();
    }
    return true;
  }

  // Called when the switch in Settings is flipped
  function setProfileLookups(enabled) {
    profileLookupsEnabled = enabled;
    if (enabled) {
      loadProfiles();
    } else {
      lookupRun++;
      profiles.clear();
      render();
    }
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const visible = accounts.filter((account) => matches(account, query));
    const failed = !errorState.hidden;

    heading.hidden = failed || accounts.length === 0;
    heading.textContent = query ? `Results — ${visible.length}` : `All accounts — ${accounts.length}`;
    emptyState.hidden = failed || accounts.length > 0;
    noResultsState.hidden = accounts.length === 0 || visible.length > 0;

    list.replaceChildren(...visible.map(createRow));
  }

  function matches(account, query) {
    const name = profiles.get(account.minecraftUuid)?.name ?? '';
    return [name, account.minecraftUuid, account.discordId].some((value) => value.toLowerCase().includes(query));
  }

  function createRow(account) {
    const profile = profiles.get(account.minecraftUuid);

    const row = document.createElement('li');
    row.className = 'account';
    row.classList.toggle('has-name', Boolean(profile));

    const avatar = document.createElement('canvas');
    avatar.className = 'avatar';
    if (profile?.face) {
      drawFace(avatar, profile.face);
    } else {
      // No skin to show (not looked up yet, lookups off, or the player has none), so use the generated pattern
      drawAvatar(avatar, account.minecraftUuid);
    }

    const details = document.createElement('div');
    details.className = 'account-details';
    details.append(
      createCopyable('account-uuid', account.minecraftUuid, 'Minecraft UUID'),
      createCopyable('account-discord', account.discordId, 'Discord ID', 'Discord ID '),
    );

    const ids = document.createElement('div');
    ids.className = 'account-ids';
    if (profile) {
      ids.append(createCopyable('account-name', profile.name, 'Minecraft name'));
    }
    ids.append(details);

    const unlinkButton = document.createElement('button');
    unlinkButton.className = 'button unlink-button';
    unlinkButton.textContent = 'Unlink';
    unlinkButton.addEventListener('click', () => askToUnlink(account));

    row.append(avatar, ids, unlinkButton);
    return row;
  }

  // A value that copies itself to the clipboard when clicked
  function createCopyable(className, value, label, prefix = '') {
    const button = document.createElement('button');
    button.className = `copyable ${className}`;
    button.title = `Copy ${label}`;

    const text = document.createElement('span');
    text.className = 'copyable-text';
    const valueText = document.createElement('span');
    valueText.textContent = value;
    text.append(prefix, valueText);

    button.append(text, icon('copy'));
    button.addEventListener('click', () => copyText(value, label));
    return button;
  }

  function askToUnlink(account) {
    const name = profiles.get(account.minecraftUuid)?.name;

    accountToUnlink = account;
    $('#unlink-title').textContent = name ? `Unlink ${name}?` : 'Unlink this account?';
    $('#unlink-uuid').textContent = account.minecraftUuid;
    $('#unlink-discord').textContent = account.discordId;
    unlinkDialog.showModal();
  }

  async function unlink(account) {
    const result = await window.api.unlinkAccount(account.minecraftUuid);
    if (!result.ok) {
      toast(`Couldn't unlink: ${result.error}`, 'error');
      return;
    }

    toast(result.removed ? 'Account unlinked' : 'That account was already unlinked');
    // Read the list again rather than editing it by hand, so it always matches the database
    await refresh();
  }

  searchInput.addEventListener('input', render);

  refreshButton.addEventListener('click', async () => {
    refreshButton.classList.add('is-spinning');
    refreshButton.addEventListener('animationend', () => refreshButton.classList.remove('is-spinning'), { once: true });
    await refresh();
  });

  $('#accounts-retry').addEventListener('click', refresh);
  $('#accounts-choose').addEventListener('click', onChooseDatabase);

  // Pressing either button in the dialog submits its form, which also closes it. Only the Unlink button
  // counts as a yes. Escape and clicking outside close the dialog without submitting, so they do nothing.
  unlinkDialog.querySelector('form').addEventListener('submit', (event) => {
    if (event.submitter?.value === 'confirm' && accountToUnlink) {
      unlink(accountToUnlink);
    }
    accountToUnlink = null;
  });

  // A click on the dimmed area around the dialog lands on the <dialog> element itself
  unlinkDialog.addEventListener('click', (event) => {
    if (event.target === unlinkDialog) {
      unlinkDialog.close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !$('#view-accounts').hidden) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  return { refresh, setProfileLookups };
}
