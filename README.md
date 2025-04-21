# Codex CLI GUI v5

This release includes:
- Patched syntax issues in `utils/codeReviewer.js`.
- Added `winston` as a dependency to fix logger errors.
- Included updated security and UX improvements from v5 audit.

**Note:** If you see `[ERROR:atom_cache.cc] Add _NET_WM_STATE_MODAL to kAtomsToCache` in the console on Linux, this is a benign warning from Electron/GTK and can be safely ignored.

## Onboarding Flow Fix
- Expose `onboardAPI` in preload to allow saving API key and signaling completion.
- Updated onboarding page script to invoke `saveKey` and `complete()` on button click.

**Onboarding Script Update:** Now using input id="key" and button id="save" with improved DOMContentLoaded handler.
