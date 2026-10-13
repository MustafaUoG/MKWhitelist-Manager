// Electron Forge builds the app you can hand to other people:
//   npm run package  -> out/MKWhitelist Manager-<platform>-<arch>/  (a folder you can run directly)
//   npm run make     -> out/make/  (a Windows installer and a zip)

// Only these go into the built app. Everything else in the project folder is left out.
const PACKAGED_PATHS = ['/package.json', '/src', '/assets', '/node_modules'];

module.exports = {
  packagerConfig: {
    name: 'MKWhitelist Manager',
    executableName: 'mkwhitelist-manager',
    // No file extension: Forge picks icon.ico on Windows
    icon: 'assets/icon',
    asar: true,
    ignore: (file) => file !== '' && !PACKAGED_PATHS.some((allowed) => file === allowed || file.startsWith(`${allowed}/`)),
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mkwhitelist_manager',
        setupIcon: 'assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
    },
  ],
};
