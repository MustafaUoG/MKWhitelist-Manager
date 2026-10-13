# MKWhitelist Manager

The desktop companion app for the [MKWhitelist](https://github.com/MustafaUoG/MKWhitelist) Minecraft plugin. It lets you see, search and unlink linked accounts and edit the plugin's Discord settings, without opening the database or `config.yml` by hand.

Built with [Electron](https://www.electronjs.org).

## Features

- **Linked accounts**: every player's Minecraft name and face, their UUID and the Discord ID it's linked to, with search, click-to-copy and unlink
- **Discord settings**: edit the bot token and server ID in the plugin's `config.yml`, with the same checks the plugin runs on startup
- **Dark and light themes**

## Using it

1. Download the installer from [Releases](../../releases) and run it
2. On first launch, choose your server's `linked_accounts.db`. It's in your Minecraft server folder under `plugins/MKWhitelist`
3. That's it. The app remembers the file, and you can switch to another one under **Settings**

After changing the Discord settings, restart your Minecraft server or run `/mkwhitelist reload` for them to take effect.

> [!NOTE]
> Unlinking here doesn't kick a player who is already online straight away. The plugin re-checks online players every 90 seconds and kicks them then.

### Names and skins

Minecraft names and faces are looked up from Mojang, one request per player. They're the only thing the app goes online for.

- Answers are saved for a day, so a renamed player or a new skin can take up to a day to show
- Players on an offline-mode server (and Bedrock players) don't have Mojang accounts, so they show as a UUID with a generated picture
- Mojang limits how many lookups it answers at once. With a very long list, some names may only appear after pressing refresh a minute later
- To keep the app fully offline, turn off **Show Minecraft names and skins** under **Settings**

## Development

You need [Node.js](https://nodejs.org) 22.13 or newer.

```bash
npm install
```

```bash
npm start
```

While running with `npm start`, **F12** opens the developer tools and **F5** reloads the page.

To build the Windows installer and a zip into `out/make`:

```bash
npm run make
```

## How it's organised

| Path | What it does |
|---|---|
| `src/main/main.js` | Starts the app, creates the window, and answers requests from the page |
| `src/main/database.js` | Reads and deletes rows in `linked_accounts.db` |
| `src/main/pluginConfig.js` | Reads and updates the plugin's `config.yml` |
| `src/main/profiles.js` | Looks up Minecraft names and skins from Mojang and saves the answers |
| `src/main/settings.js` | Remembers the chosen database, theme and other choices |
| `src/preload.js` | The short list of things the page is allowed to ask the app to do |
| `src/renderer/` | The page itself: HTML, CSS and JavaScript |

The page has no direct access to files or the database. It can only call the functions listed in `src/preload.js`, and the main process does the real work.

Your choices are saved in `%APPDATA%\MKWhitelist Manager\settings.json`, and looked-up names and faces in `profiles-cache.json` next to it. Deleting the cache file is safe. It just makes the app look everyone up again.

## Credits

Icons are from [Feather](https://feathericons.com) (MIT licence).
