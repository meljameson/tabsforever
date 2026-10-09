What it does

New-tab dashboard of collections. You can rename, collapse, reorder and delete them, with an Undo option after deleting. "Open all" opens a collection's links as tabs in the current window, and "New window" opens them in a fresh window.
Open-tabs sidebar. Drag a tab onto a collection, onto a specific card position, or onto the "new collection" zone. "Save window" saves every tab at once, and there's an optional "close tabs after saving" setting.
Cards. Drag to reorder or move between collections. Click to open, or Ctrl/Cmd/middle-click to open in the background. You can edit a card's title, add a note and add tags.
Search. Fuzzy search covers titles, URLs, notes and tags; press / to focus it. Tag chips filter the view.
Background script. A right-click menu offers "Save tab to → new or recent collection" and "Save all tabs in this window". Clicking the toolbar icon saves the window.
Import/export. Toby JSON import (including lists nested under groups or spaces), plus tabsforever's own backup format, with a choice to merge or replace.
Testing

The unit tests cover the data operations, drag-and-drop outcomes, Toby and backup import, search, and storage.
For the browser test I installed a temporary Chromium in a scratch folder (nothing was added to the project). It covered saving, renaming, both kinds of drag, editing tags, search, tag filtering, Toby import, delete with undo, and reloading. That run caught two bugs, now fixed: tags could end up as ##later, and the trash icon showed as a missing-glyph box.
Not yet tested

Firefox: it builds, but I haven't run it in Firefox.
Right-click menu and toolbar button: I only confirmed their handlers are registered, not clicked them in a real browser.
Two gaps

There's no extension icon yet, so browsers show a default one.
The folder isn't a git repository. Tell me if you want me to initialise one and commit.
Small differences from the plan

One global stylesheet instead of CSS modules.
React 19 instead of 18.
Tags are worked out from the cards instead of being stored as a separate list.
To try it

Chrome: run npm run dev, or npm run build and then load .output/chrome-mv3 as an unpacked extension.
Firefox: run npm run dev:firefox.