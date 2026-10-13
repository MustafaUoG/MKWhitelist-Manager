import { $, toast } from './ui.js';

// The Settings page. onChooseDatabase opens the file picker.
export function createSettingsView({ onChooseDatabase }) {
  const form = $('#discord-form');
  const tokenInput = $('#bot-token');
  const guildInput = $('#guild-id');
  const notice = $('#config-notice');
  const unsavedBar = $('#unsaved-bar');

  // What is currently in config.yml, to tell whether the fields have been edited
  let saved = { botToken: '', guildId: '' };

  async function refresh() {
    const result = await window.api.readConfig();
    const usable = result.ok && result.exists;

    if (!result.ok) {
      notice.textContent = `Couldn't read config.yml: ${result.error}`;
    } else if (!result.exists) {
      notice.textContent = `No config.yml was found next to your database (${result.configPath}). Start your Minecraft server once with the plugin installed to create it.`;
    }
    notice.hidden = usable;
    tokenInput.disabled = !usable;
    guildInput.disabled = !usable;

    saved = { botToken: usable ? result.botToken : '', guildId: usable ? result.guildId : '' };
    reset();
  }

  function reset() {
    tokenInput.value = saved.botToken;
    guildInput.value = saved.guildId;
    showFieldErrors({});
    updateUnsavedBar();
  }

  function updateUnsavedBar() {
    unsavedBar.hidden = tokenInput.value === saved.botToken && guildInput.value === saved.guildId;
  }

  function showFieldErrors(fieldErrors) {
    showFieldError(tokenInput, fieldErrors.botToken);
    showFieldError(guildInput, fieldErrors.guildId);
  }

  function showFieldError(input, message) {
    const error = $(`#${input.id}-error`);
    error.textContent = message ?? '';
    error.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  async function save() {
    const result = await window.api.saveConfig({ botToken: tokenInput.value, guildId: guildInput.value });
    if (!result.ok) {
      toast(`Couldn't save: ${result.error}`, 'error');
      return;
    }

    if (!result.saved) {
      showFieldErrors(result.fieldErrors);
      return;
    }

    saved = { botToken: result.botToken, guildId: result.guildId };
    reset();
    toast('Saved. Restart your server or run /mkwhitelist reload to apply.');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });
  form.addEventListener('input', updateUnsavedBar);
  $('#config-reset').addEventListener('click', reset);

  // The eye buttons that show or hide a secret field
  for (const button of document.querySelectorAll('.reveal-button')) {
    button.addEventListener('click', () => {
      const input = $(`#${button.dataset.reveals}`);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(reveal));
      button.querySelector('use').setAttribute('href', reveal ? '#icon-eye-off' : '#icon-eye');
    });
  }

  for (const radio of document.querySelectorAll('input[name="theme"]')) {
    radio.checked = radio.value === document.documentElement.dataset.theme;
    radio.addEventListener('change', async () => {
      document.documentElement.dataset.theme = radio.value;
      const result = await window.api.setTheme(radio.value);
      if (!result.ok) {
        toast(`Couldn't save the theme: ${result.error}`, 'error');
      }
    });
  }

  $('#settings-db-show').addEventListener('click', () => window.api.showDatabaseInFolder());
  $('#settings-db-change').addEventListener('click', onChooseDatabase);

  return { refresh };
}
