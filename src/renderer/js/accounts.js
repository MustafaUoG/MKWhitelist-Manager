import { $, icon, toast, copyText } from './ui.js';
import { drawAvatar } from './avatar.js';

// The Linked Accounts page. onLoaded is told how each load went, onChooseDatabase opens the file picker.
export function createAccountsView({ onLoaded, onChooseDatabase }) {
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

  async function refresh() {
    const result = await window.api.listAccounts();

    accounts = result.ok ? result.accounts : [];
    errorState.hidden = result.ok;
    $('#accounts-error-message').textContent = result.ok ? '' : result.error;
    onLoaded({ ok: result.ok, count: accounts.length });
    render();
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
    return account.minecraftUuid.toLowerCase().includes(query) || account.discordId.toLowerCase().includes(query);
  }

  function createRow(account) {
    const row = document.createElement('li');
    row.className = 'account';

    const avatar = document.createElement('canvas');
    avatar.className = 'avatar';
    drawAvatar(avatar, account.minecraftUuid);

    const ids = document.createElement('div');
    ids.className = 'account-ids';
    ids.append(
      createCopyable('account-uuid', account.minecraftUuid, 'Minecraft UUID'),
      createCopyable('account-discord', account.discordId, 'Discord ID', 'Discord ID '),
    );

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
    accountToUnlink = account;
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

  return { refresh };
}
