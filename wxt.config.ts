import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'tabsforever',
    description: 'Save your tabs into collections and close them without losing anything.',
    permissions: ['tabs', 'tabGroups', 'storage', 'unlimitedStorage', 'contextMenus'],
    action: { default_title: 'Save this window to tabsforever' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Permanent: installed copies use it to find their updates. Don't change it.
          id: 'tabsforever@meljameson.github.io',
          // Self-distributed from GitHub Releases; see scripts/add-firefox-update.mjs.
          update_url: 'https://raw.githubusercontent.com/meljameson/tabsforever/main/updates.json',
          // Everything stays in local extension storage; nothing is sent anywhere.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
